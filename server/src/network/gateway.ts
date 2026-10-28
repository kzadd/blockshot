// Socket.IO entry point: every incoming message is rate limited and validated with Valibot before it
// reaches the game. Invalid or excessive messages are dropped and logged.
import type { Server, Socket } from 'socket.io';
import {
  CHAR_BY_ID,
  AbilitySchema,
  AdminLockSchema,
  AdminRoomSchema,
  AdminTargetSchema,
  TournamentSchema,
  BotAddSchema,
  COMBAT_LOCK_MS,
  DIRECTION_LENGTH_TOLERANCE,
  CreateRoomSchema,
  EmptySchema,
  GrenadeSchema,
  InputSchema,
  JoinRoomSchema,
  MAX_PING_MS,
  PLAYER,
  PingSchema,
  QUICK_CHAT,
  QUICK_CHAT_COOLDOWN_MS,
  QuickChatSchema,
  SPAWN_REQUEST_GRACE_MS,
  ShootSchema,
  SpawnSchema,
  SwitchSchema,
  TEAM_SWITCH_COOLDOWN,
  TeamSetSchema,
  VoteSchema,
  canSwitchTeam,
  clamp,
  isCharacterId,
  isMapId,
  isModeId,
  teamName,
  v,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@blockshot/shared';
import { useAbility } from '../combat/abilities';
import { throwGrenade } from '../combat/grenades';
import { handleReload, handleShoot, handleSwitch, validOrigin } from '../combat/shooting';
import type { Logger } from '../logger';
import { adminChangeRoom, adminEnd, adminKill, adminRestart, adminSwitchTeam } from '../match/admin';
import { startTournament, stopTournament } from '../match/tournament';
import { castVote } from '../match/vote';
import { addBot, removeBots } from '../players/bot';
import { queueInputs } from '../players/movement';
import type { Player } from '../players/player';
import { canJoinTeam, isTeamRoom } from '../players/teams';
import { spawnPlayer } from '../players/spawn';
import { cleanNickname, type RoomRegistry } from '../rooms/registry';
import { rankingRows, resetRanking } from '../stats/ranking';
import { sessionStats } from '../stats/sessionStats';
import { notice, roomInfo, type Room } from '../rooms/room';
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
      const error = rooms.canJoin(room, data.password, cleanNickname(data.nickname));
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
      if (p.alive || room.mode.canSpawn?.(room, p) === false) return;
      if (p.deathTime && Date.now() - p.deathTime < PLAYER.respawnDelay - SPAWN_REQUEST_GRACE_MS) return;
      spawnPlayer(room, p, CHAR_BY_ID[data.characterId], data.skin, data.color, data.camo, data.finish);
    });

    // Team modes: pick or change team. Alive players respawn on their new team's side
    on('team:set', 'misc', TeamSetSchema, (d) => {
      const c = ctx();
      if (!c || !canSwitchTeam(c.room.modeId)) return;
      const { room, p } = c;
      const team = d.team === 1 || d.team === 2 ? d.team : 0;
      if (!team || team === p.team) return;
      const now = Date.now();
      // The cooldown stops team hopping mid-game; on the character screen (not alive) you switch at once
      if (p.alive && now - p.teamAt < TEAM_SWITCH_COOLDOWN) {
        return socket.emit('notice', 'Espera unos segundos para volver a cambiar de equipo.');
      }
      if (p.alive && now - p.lastDamage < COMBAT_LOCK_MS) {
        return socket.emit('notice', 'No puedes cambiar de equipo en pleno combate.');
      }
      if (!canJoinTeam(room, p, team)) {
        return socket.emit(
          'notice',
          `${teamName(room.modeId, team)} ya tiene más jugadores: los equipos se mantienen equilibrados.`,
        );
      }
      p.team = team;
      p.teamAt = now;
      p.streak = 0;
      notice(room, `${p.name} se cambió al equipo ${teamName(room.modeId, team)}`);
      if (p.alive && p.characterId) spawnPlayer(room, p, CHAR_BY_ID[p.characterId], p.skin, p.color, p.camo, p.finish);
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

    on('player:grenade', 'combat', GrenadeSchema, (d) => {
      const c = ctx();
      if (!c?.p.alive || c.room.matchOver || c.p.grenades <= 0 || !validOrigin(c.room, c.p, d.o)) return;
      const len = Math.hypot(...d.d);
      if (Math.abs(len - 1) > DIRECTION_LENGTH_TOLERANCE) return;
      throwGrenade(c.room, c.p, d.o, [d.d[0] / len, d.d[1] / len, d.d[2] / len], Date.now());
    });

    on('player:ability', 'combat', AbilitySchema, (d) => {
      const c = ctx();
      if (!c?.p.alive || !validOrigin(c.room, c.p, d.o)) return;
      const len = Math.hypot(...d.d);
      if (Math.abs(len - 1) > DIRECTION_LENGTH_TOLERANCE) return;
      useAbility(c.room, c.p, d.o, [d.d[0] / len, d.d[1] / len, d.d[2] / len], Date.now());
    });

    on('player:shoot', 'combat', ShootSchema, (d) => {
      const c = ctx();
      if (c?.p.alive && !c.room.matchOver) handleShoot(c.room, c.p, d);
    });

    // ------------------------------------------------------------ Server PC only
    on('bot:add', 'lobby', BotAddSchema, (d) => {
      const c = ctx();
      if (!admin || !c) return;
      const error = addBot(rooms, c.room, d?.level);
      if (error) socket.emit('notice', error);
    });

    on('bot:clear', 'lobby', EmptySchema, () => {
      const c = ctx();
      if (admin && c && !removeBots(rooms, c.room)) socket.emit('notice', 'No hay bots en la sala.');
    });

    // Quick chat: tactical phrases only reach the team in team modes
    on('chat:quick', 'misc', QuickChatSchema, (d) => {
      const c = ctx();
      const now = Date.now();
      if (!c || now - c.p.chatAt < QUICK_CHAT_COOLDOWN_MS) return;
      c.p.chatAt = now;
      const msg = { name: c.p.name, team: c.p.team, i: d.i };
      if (QUICK_CHAT[d.i]!.all || !isTeamRoom(c.room)) return c.room.channel.broadcast('chat', [msg]);
      for (const mate of c.room.players.values()) if (mate.team === c.p.team) c.room.channel.to(mate.id, 'chat', [msg]);
    });

    on('vote', 'misc', VoteSchema, (d) => {
      const c = ctx();
      if (c) castVote(c.room, c.p.id, d.i);
    });

    on('admin:stats', 'lobby', EmptySchema, (_d, cb) => {
      if (admin && cb) (cb as (rows: unknown) => void)(sessionStats(rooms.all()));
    });

    on('ranking:get', 'lobby', EmptySchema, (_d, cb) => cb && (cb as (rows: unknown) => void)(rankingRows()));

    // Room control (server PC only). The target must be in the admin's own room
    const target = (id: string) => {
      const c = ctx();
      const p = c?.room.players.get(id);
      return admin && c && p ? { room: c.room, p } : null;
    };
    on('admin:kick', 'lobby', AdminTargetSchema, (d) => {
      const t = target(d.id);
      if (!t || t.p.id === socket.id) return;
      const { room, p } = t;
      const s = io.sockets.sockets.get(p.id);
      if (s) {
        room.banned.add(p.name);
        s.leave(room.id);
        s.join(LOBBY_CHANNEL);
        s.data.roomId = null;
        s.emit('kicked', 'El admin te ha sacado de la sala.');
      }
      rooms.removePlayer(room, p.id); // a bot just goes
      log.info({ room: room.id, name: p.name }, 'player kicked');
    });
    on('admin:kill', 'combat', AdminTargetSchema, (d) => {
      const t = target(d.id);
      if (t) adminKill(t.room, t.p);
    });
    on('admin:team', 'misc', AdminTargetSchema, (d) => {
      const t = target(d.id);
      if (t) adminSwitchTeam(t.room, t.p);
    });
    on('admin:restart', 'lobby', EmptySchema, () => {
      const c = ctx();
      if (!admin || !c) return;
      adminRestart(c.room);
      notice(c.room, 'El admin reinició la partida');
    });
    on('admin:end', 'lobby', EmptySchema, () => {
      const c = ctx();
      if (admin && c) adminEnd(c.room);
    });
    on('admin:room', 'lobby', AdminRoomSchema, (d) => {
      const c = ctx();
      if (!admin || !c || !isMapId(d.mapId) || !isModeId(d.mode)) return;
      adminChangeRoom(c.room, { mapId: d.mapId, mode: d.mode });
    });
    on('admin:lock', 'lobby', AdminLockSchema, (d) => {
      const c = ctx();
      if (!admin || !c) return;
      c.room.closed = d.locked;
      c.room.channel.broadcast('room:changed', [roomInfo(c.room)]);
      notice(c.room, d.locked ? 'El admin cerró la sala: no entra nadie más' : 'El admin abrió la sala');
    });
    // Anyone in the room can start a league; only its creator or the admin can stop it
    on('tournament:set', 'lobby', TournamentSchema, (d) => {
      const c = ctx();
      if (!c) return;
      const t = c.room.tournament;
      if (!d.rounds) {
        if (t && (admin || t.by === c.p.id)) stopTournament(c.room);
        return;
      }
      if (t) return;
      startTournament(c.room, d.rounds, c.p.id);
      adminChangeRoom(c.room, { mapId: c.room.map.id, mode: 'ffa' }); // round 1 starts now, free for all
    });

    on('admin:ranking:reset', 'lobby', EmptySchema, () => {
      if (!admin) return;
      resetRanking();
      socket.emit('notice', 'Ranking reiniciado: la temporada anterior quedó guardada en data/.');
    });

    socket.on('disconnect', (reason) => {
      log.debug({ socket: socket.id, reason }, 'disconnected');
      leave();
    });
  });
}
