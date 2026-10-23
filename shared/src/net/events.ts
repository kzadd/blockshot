// Typed Socket.IO protocol. Short keys in high-frequency payloads keep snapshots small.
import type { Vec3 } from '../core/math';
import type { CharacterId, SkinId } from '../characters/characters';
import type { MapId, SizeId } from '../maps/types';
import type { ModeId, SideTeam, Team } from '../modes/modes';
import type { MoveInput, MoveState } from '../movement/movement';
import type { WeaponId } from '../weapons/weapons';

export interface RoomSummary {
  id: string;
  name: string;
  players: number;
  max: number;
  locked: boolean;
  host: string;
  map: string;
  size: string;
  mode: string;
  mapId: MapId;
  sizeId: SizeId;
  modeId: ModeId;
  limit: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  scoreLimit: number;
  mapId: MapId;
  size: SizeId;
  mode: ModeId;
  max: number;
}

export type JoinResult = { ok: true; you: string; room: RoomInfo } | { ok: false; error: string };

export interface CreateRoomRequest {
  nickname: string;
  name?: string;
  password?: string;
  mapId?: string;
  size?: string;
  mode?: string;
  scoreLimit?: number;
  max?: number;
}

export interface JoinRoomRequest {
  roomId: string;
  nickname: string;
  password?: string;
}

/** One player in a snapshot. */
export interface PlayerSnapshot {
  id: string;
  /** name */
  n: string;
  /** character */
  c: CharacterId | null;
  /** skin */
  sk: SkinId;
  x: number;
  y: number;
  z: number;
  /** yaw */
  ry: number;
  /** pitch */
  rx: number;
  /** weapon slot */
  s: number;
  /** sliding */
  sl: number;
  /** crouching */
  cr: number;
  /** alive */
  a: number;
  /** hp */
  h: number;
  /** spawn protected */
  pr: number;
  /** kills */
  k: number;
  /** deaths */
  d: number;
  /** team */
  tm: Team;
  /** ping */
  pg: number;
  /** streak */
  st: number;
  /** captures / confirmed tags */
  cp: number;
  /** gun game level */
  lv: number;
  /** max hp */
  mh: number;
  /** armor */
  ar: number;
  /** radar active */
  rd: number;
}

export interface FlagSnapshot {
  x: number;
  y: number;
  z: number;
  /** carrier id */
  c: string | null;
  /** at home */
  h: number;
}

/** Kill confirmed tag: [id, x, y, z, team of the victim] */
export type TagSnapshot = [number, number, number, number, SideTeam];

export interface InfectSnapshot {
  /** 1 once the first infected has been picked */
  st: number;
  /** ms left (match, or until the first pick; -1 = waiting for players) */
  t: number;
}

export interface StateSnapshot {
  players: PlayerSnapshot[];
  ts: Record<SideTeam, number> | null;
  fl: Record<SideTeam, FlagSnapshot> | null;
  tg: TagSnapshot[] | null;
  inf: InfectSnapshot | null;
}

/** A batch of input commands (sent every CLIENT_SEND_MS, one command per FIXED_DT step). */
export interface InputMessage {
  c: MoveInput[];
}

/** Authoritative movement state of your own player after the last processed command. */
export interface AckMessage {
  seq: number;
  s: MoveState;
  /** spawn counter: acks from a previous life are ignored */
  life: number;
}

export interface ShootMessage {
  o: Vec3;
  d: Vec3[];
  lag: number;
}

export interface SpawnedMessage {
  x: number;
  y: number;
  z: number;
  ry: number;
  characterId: CharacterId;
  skin: SkinId;
  hp: number;
  level: number;
  team: Team;
  /** spawn counter, echoed by every ack of this life */
  life: number;
}

export interface KillEvent {
  killer: string;
  killerName: string;
  killerTeam: Team;
  killerChar: CharacterId | null;
  killerHp: number;
  victim: string;
  victimName: string;
  victimTeam: Team;
  weapon: string;
  head: boolean;
  streak: number;
  ended: number;
  reward: string | undefined;
}

export interface BestPlay {
  t: string;
  v: string;
  n: string;
}

export interface MatchEnd {
  winner: string;
  team: Team;
  scores: { name: string; kills: number; deaths: number; team: Team }[];
  best: BestPlay[];
  restartIn: number;
}

export type FlagEventType = 'take' | 'drop' | 'return' | 'capture';

export interface ServerToClientEvents {
  rooms: (rooms: RoomSummary[]) => void;
  notice: (text: string) => void;
  state: (s: StateSnapshot) => void;
  'player:spawned': (d: SpawnedMessage) => void;
  'player:ack': (d: AckMessage) => void;
  damaged: (d: { hp: number; from: [number, number] }) => void;
  hitmarker: (d: { head: boolean; kill: boolean; dmg: number; at: Vec3 }) => void;
  kill: (d: KillEvent) => void;
  shot: (d: { id: string; w: WeaponId | null; e: Vec3[] }) => void;
  loadout: (d: { level: number; team?: Team }) => void;
  flag: (d: { type: FlagEventType; team?: SideTeam; name?: string }) => void;
  tag: (d: { type: 'confirm' | 'deny' }) => void;
  'match:end': (d: MatchEnd) => void;
  'match:start': () => void;
}

export interface ClientToServerEvents {
  'rooms:list': (cb: (rooms: RoomSummary[]) => void) => void;
  'room:create': (data: CreateRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:join': (data: JoinRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:leave': () => void;
  'net:ping': (d: { rtt: number }, cb: () => void) => void;
  'player:spawn': (d: { characterId: string; skin?: string }) => void;
  'team:set': (d: { team: number }) => void;
  'player:input': (d: InputMessage) => void;
  'player:switch': (d: { slot: number }) => void;
  'player:reload': () => void;
  'player:shoot': (d: ShootMessage) => void;
}
