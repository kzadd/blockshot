// Socket.IO entry point: every incoming message is rate limited and validated with Valibot before it
// reaches the game. Invalid or excessive messages are dropped and logged.
import type { Server, Socket } from 'socket.io';
import {
  CHAR_BY_ID,
  COMBAT_LOCK_MS,
  CreateRoomSchema,
  EmptySchema,
  InputSchema,
  JoinRoomSchema,
  MAX_PING_MS,
  PLAYER,
  PingSchema,
  SPAWN_REQUEST_GRACE_MS,
  ShootSchema,
  SpawnSchema,
  SwitchSchema,
  TEAM_SWITCH_COOLDOWN,
  TeamSetSchema,
  canSwitchTeam,
  clamp,
  isCharacterId,
  teamName,
  v,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@blockshot/shared';
import { handleReload, handleShoot, handleSwitch } from '../combat/shooting';
import type { Logger } from '../logger';
import { addBot, removeBots } from '../players/bot';
import { queueInputs } from '../players/movement';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { cleanNickname, type RoomRegistry } from '../rooms/registry';
import { notice, type Room } from '../rooms/room';
import { MESSAGE_LIMITS, RateLimiter, type MessageCategory } from './rateLimiter';

export const LOBBY_CHANNEL = 'lobby';
/** Do not log more than one dropped message per socket and second (floods would flood the log). */
const DROP_LOG_INTERVAL_MS = 1000;
/** Open rooms at most (a class needs a handful; this stops room spam). */
const MAX_ROOMS = 40;

interface SocketData {
  roomId: string | null;
}
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

type Schema = v.GenericSchema;

const LOOPBACK = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/;

/**
 * True when the socket comes from the server's own PC. Behind a local proxy (Vite in development) the real
 * client is the last X-Forwarded-For entry; that header is only trusted when the proxy itself is local.
 */
export function isLocalSocket(address: string, forwardedFor: string | string[] | undefined): boolean {
  if (!LOOPBACK.test(address)) return false;
  const fwd = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const client = fwd?.split(',').pop()?.trim();
  return !client || LOOPBACK.test(client);
}
type Callback = (...args: never[]) => void;

export function attachGateway(io: GameServer, rooms: RoomRegistry, log: Logger): void {
  io.on('connection', (socket: GameSocket) => {
    socket.join(LOBBY_CHANNEL);
    socket.data.roomId = null;
    const admin = isLocalSocket(socket.handshake.address, socket.handshake.headers['x-forwarded-for']);
    socket.emit('rooms', rooms.list());
    log.debug({ socket: socket.id }, 'connected');

    const limiter = new RateLimiter(MESSAGE_LIMITS);
    let lastDropLog = 0;
    const drop = (event: string, reason: string, extra?: object) => {
      const now = Date.now();
      if (now - lastDropLog < DROP_LOG_INTERVAL_MS) return;
      lastDropLog = now;
      log.warn({ socket: socket.id, event, reason, ...extra }, 'message dropped');
    };

    /** Registers a handler with rate limit + schema validation. `cb` is passed when the client sent one. */
    function on<S extends Schema>(
      event: keyof ClientToServerEvents,
      category: MessageCategory,
      schema: S,
      handler: (data: v.InferOutput<S>, cb: Callback | undefined) => void,
    ): void {
      socket.on(event, ((...args: unknown[]) => {
        const last = args[args.length - 1];
        const cb = typeof last === 'function' ? (last as Callback) : undefined;
        const payload = cb ? args.slice(0, -1)[0] : args[0];
        if (!limiter.take(category)) return drop(event, 'rate limit');
        const parsed = v.safeParse(schema, payload);
        if (!parsed.success) {
          return drop(event, 'invalid', { issues: parsed.issues.map((i) => i.message).slice(0, 3) });
        }
        try {
          handler(parsed.output, cb);
        } catch (err) {
          log.error({ err, socket: socket.id, event }, 'handler failed');
        }
      }) as never);
    }

    const ctx = (): { room: Room; p: Player } | null => {
      const room = socket.data.roomId ? rooms.get(socket.data.roomId) : undefined;
      const p = room?.players.get(socket.id);
      return room && p ? { room, p } : null;
    };

    const leave = () => {
      const c = ctx();
      socket.data.roomId = null;
      if (!c) return;
      socket.leave(c.room.id);
      socket.join(LOBBY_CHANNEL);
      rooms.removePlayer(c.room, socket.id);
    };

    const enter = (room: Room, nickname: string, cb: Callback) => {
      socket.leave(LOBBY_CHANNEL);
      socket.join(room.id);
      socket.data.roomId = room.id;
      (cb as (res: unknown) => void)({ ...rooms.addPlayer(room, socket.id, nickname), admin });
    };

    // ------------------------------------------------------------ Lobby
    on('rooms:list', 'lobby', EmptySchema, (_d, cb) => cb && (cb as (r: unknown) => void)(rooms.list()));

    on('room:create', 'lobby', CreateRoomSchema, (data, cb) => {
      if (!cb) return;
      if (rooms.count() >= MAX_ROOMS) {
        return (cb as (r: unknown) => void)({ ok: false, error: 'Hay demasiadas salas abiertas. Únete a una.' });
      }
      leave();
      const nickname = cleanNickname(data.nickname);
      const room = rooms.create(data, nickname);
      log.info({ room: room.id, mode: room.modeId, map: room.map.id, size: room.map.size }, 'room created');
      enter(room, nickname, cb);
    });

    on('room:join', 'lobby', JoinRoomSchema, (data, cb) => {
      if (!cb) return;
      const room = rooms.get(data.roomId);
      const error = rooms.canJoin(room, data.password);
      if (error || !room) return (cb as (r: unknown) => void)({ ok: false, error });
      if (room.id === socket.data.roomId)
        return (cb as (r: unknown) => void)({ ok: false, error: 'Ya estás en esta sala.' });
      leave();
      enter(room, cleanNickname(data.nickname), cb);
    });

    on('room:leave', 'lobby', EmptySchema, leave);

    on('net:ping', 'misc', PingSchema, (d, cb) => {
      const c = ctx();
      if (c && d.rtt !== undefined) c.p.ping = Math.round(clamp(d.rtt, 0, MAX_PING_MS));
      cb?.();
    });

    // ------------------------------------------------------------ Player
    on('player:spawn', 'misc', SpawnSchema, (data) => {
      const c = ctx();
      if (!c || c.room.matchOver || !isCharacterId(data.characterId)) return;
      const { room, p } = c;
      if (p.alive) return;
      if (p.deathTime && Date.now() - p.deathTime < PLAYER.respawnDelay - SPAWN_REQUEST_GRACE_MS) return;
      spawnPlayer(room, p, CHAR_BY_ID[data.characterId], data.skin, data.color);
    });

    // Team modes: pick or change team. Alive players respawn on their new team's side
    on('team:set', 'misc', TeamSetSchema, (d) => {
      const c = ctx();
      if (!c || !canSwitchTeam(c.room.modeId)) return;
      const { room, p } = c;
      const team = d.team === 1 || d.team === 2 ? d.team : 0;
      if (!team || team === p.team) return;
      const now = Date.now();
      if (now - p.teamAt < TEAM_SWITCH_COOLDOWN) {
        return socket.emit('notice', 'Espera unos segundos para volver a cambiar de equipo.');
      }
      if (p.alive && now - p.lastDamage < COMBAT_LOCK_MS) {
        return socket.emit('notice', 'No puedes cambiar de equipo en pleno combate.');
      }
      p.team = team;
      p.teamAt = now;
      p.streak = 0;
      notice(room, `${p.name} se cambió al equipo ${teamName(room.modeId, team)}`);
      if (p.alive && p.characterId) spawnPlayer(room, p, CHAR_BY_ID[p.characterId], p.skin, p.color);
    });

    // Movement commands: simulated by the server at a fixed rate (players/movement.ts)
    on('player:input', 'movement', InputSchema, (d) => {
      const c = ctx();
      if (c?.p.alive) queueInputs(c.p, d.c);
    });

    on('player:switch', 'combat', SwitchSchema, (d) => {
      const c = ctx();
      if (c?.p.alive) handleSwitch(c.p, d.slot);
    });

    on('player:reload', 'combat', EmptySchema, () => {
      const c = ctx();
      if (c?.p.alive) handleReload(c.p);
    });

    on('player:shoot', 'combat', ShootSchema, (d) => {
      const c = ctx();
      if (c?.p.alive && !c.room.matchOver) handleShoot(c.room, c.p, d);
    });

    // ------------------------------------------------------------ Server PC only
    on('bot:add', 'lobby', EmptySchema, () => {
      const c = ctx();
      if (!admin || !c) return;
      const error = addBot(rooms, c.room);
      if (error) socket.emit('notice', error);
    });

    on('bot:clear', 'lobby', EmptySchema, () => {
      const c = ctx();
      if (admin && c && !removeBots(rooms, c.room)) socket.emit('notice', 'No hay bots en la sala.');
    });

    socket.on('disconnect', (reason) => {
      log.debug({ socket: socket.id, reason }, 'disconnected');
      leave();
    });
  });
}
