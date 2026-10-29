import crypto from 'node:crypto';
import {
  MAP_SIZES,
  MODE_BY_ID,
  NICKNAME_MAX,
  PASSWORD_MAX,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  ROOM_NAME_MAX,
  clamp,
  getColliders,
  getMap,
  isMapId,
  isModeId,
  isSizeId,
  teamName,
  type CreateRoomInput,
  type JoinResult,
  type RoomSummary,
} from '@blockshot/shared';
import { createMode } from '../modes';
import { resetWorld } from '../combat/worldObjects';
import { BOT_PREFIX } from '../players/bot';
import { createPlayer } from '../players/player';
import { foldPlayer } from '../stats/sessionStats';
import { notice, roomInfo, type Room, type RoomChannel } from './room';

const ROOM_ID_BYTES = 3;
const DEFAULT_NICKNAME = 'Jugador';

/** Trims, collapses whitespace and cuts to `max` characters; falls back to `def` when empty. */
export const cleanText = (s: unknown, max: number, def: string): string =>
  (typeof s === 'string' ? s.replace(/\p{C}/gu, '').trim().replace(/\s+/g, ' ').slice(0, max) : '') || def;
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const cleanNickname = (s: unknown): string => cleanText(s, NICKNAME_MAX, DEFAULT_NICKNAME);

export interface RegistryEvents {
  /** the room list changed (lobby must be refreshed) */
  changed(): void;
}

/** All rooms of the server: create, join, leave and the lobby list. */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly channelFor: (roomId: string) => RoomChannel,
    private readonly events: RegistryEvents,
  ) {}

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  all(): IterableIterator<Room> {
    return this.rooms.values();
  }

  count(): number {
    return this.rooms.size;
  }

  list(): RoomSummary[] {
    return [...this.rooms.values()].map((r) => ({
      id: r.id,
      name: r.name,
      players: r.players.size,
      max: r.max,
      locked: !!r.passHash,
      host: r.hostName,
      map: r.map.name,
      size: r.map.sizeName,
      mode: MODE_BY_ID[r.modeId].name,
      mapId: r.map.id,
      sizeId: r.map.size,
      modeId: r.modeId,
      limit: r.scoreLimit,
    }));
  }

  create(data: CreateRoomInput, nickname: string): Room {
    const password = typeof data.password === 'string' ? data.password.slice(0, PASSWORD_MAX) : '';
    const mapId = isMapId(data.mapId) ? data.mapId : 'patio';
    const size = isSizeId(data.size) ? data.size : 'm';
    const max = clamp(Number(data.max) || MAP_SIZES[size].players, ROOM_MIN_PLAYERS, ROOM_MAX_PLAYERS);
    const map = getMap(mapId, size);
    const modeId = isModeId(data.mode) ? data.mode : 'ffa';
    const limit = Number(data.scoreLimit);
    const id = crypto.randomBytes(ROOM_ID_BYTES).toString('hex');
    const room: Room = {
      id,
      name: cleanText(data.name, ROOM_NAME_MAX, `Sala de ${nickname}`),
      passHash: password ? hash(password) : null,
      hostName: nickname,
      max,
      map,
      colliders: getColliders(map),
      players: new Map(),
      modeId,
      // Replaced right below: the mode strategy needs the room to keep its own state
      mode: undefined as never,
      scoreLimit: MODE_BY_ID[modeId].limits.includes(limit) ? limit : MODE_BY_ID[modeId].def,
      teamScore: { 1: 0, 2: 0 },
      matchOver: false,
      firstBlood: false,
      restartTimer: null,
      channel: this.channelFor(id),
      vote: null,
      grenades: [],
      deployables: [],
      // Filled right below (resetWorld also builds the colliders)
      world: undefined as never,
      closed: false,
      banned: new Set(),
      tournament: null,
      lobbyChanged: () => this.events.changed(),
    };
    room.mode = createMode(modeId, room);
    resetWorld(room);
    this.rooms.set(id, room);
    return room;
  }

  /** Checks the room can be joined; returns an error message for the client otherwise. */
  canJoin(room: Room | undefined, password: string | undefined, nickname = ''): string | null {
    if (!room) return 'La sala ya no existe.';
    if (room.banned.has(nickname)) return 'El admin te ha expulsado de esta sala.';
    if (room.closed) return 'El admin ha cerrado la sala: espera a que la abra.';
    if (room.players.size >= room.max) return 'La sala está llena.';
    if (room.passHash && hash(String(password ?? '')) !== room.passHash) return 'Contraseña incorrecta.';
    return null;
  }

  addPlayer(room: Room, socketId: string, nickname: string): JoinResult {
    const p = createPlayer(socketId, nickname, room.mode.initialTeam(room));
    room.players.set(socketId, p);
    const team = p.team ? ` · ${teamName(room.modeId, p.team)}` : '';
    room.channel.broadcast('notice', [`${nickname} entró en la sala${team}`], socketId);
    this.events.changed();
    return {
      ok: true,
      you: socketId,
      room: roomInfo(room),
    };
  }

  removePlayer(room: Room, socketId: string): void {
    const p = room.players.get(socketId);
    if (!p) return;
    foldPlayer(p);
    room.players.delete(socketId);
    notice(room, `${p.name} salió de la sala`);
    // Bots alone do not keep a room open
    if ([...room.players.keys()].every((id) => id.startsWith(BOT_PREFIX))) {
      if (room.restartTimer) clearTimeout(room.restartTimer);
      this.rooms.delete(room.id);
    }
    this.events.changed();
  }
}
