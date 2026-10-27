// Typed Socket.IO protocol. Short keys in high-frequency payloads keep snapshots small.
import type { Vec3 } from '../core/math';
import type { CharacterId, SkinId } from '../characters/characters';
import type { TournamentResult } from '../modes/tournament';
import type { MapId, SizeId } from '../maps/types';
import type { BotLevel } from '../modes/bots';
import type { MedalId } from '../modes/medals';
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
  /** the admin closed the room: nobody new can join */
  closed: boolean;
  /** a league tournament is on: round being played and how many */
  tour: { round: number; rounds: number; by: string } | null;
}

/** `admin`: the player opened the game on the server's own PC (practice bots and other test tools). */
export type JoinResult = { ok: true; you: string; room: RoomInfo; admin?: boolean } | { ok: false; error: string };

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
  /** outfit colour picked by the player (OUTFIT_COLORS) */
  co: string;
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
  /** medals this match */
  md: number;
  /** shield up (Tanque's ability) */
  sh: number;
  /** scoped in with a sniper: others see the lens glint */
  gl: number;
  /** ms until the ability is ready again (0 = ready) */
  ac: number;
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

/** Domination zone: [owner, capture -100 (Blue) … 100 (Red), contested] */
export type DomSnapshot = [Team, number, number];

/** Rounds: phase (0 waiting for players, 1 playing, 2 break), round number, ms left in the phase. */
export interface RoundSnapshot {
  p: 0 | 1 | 2;
  n: number;
  t: number;
}

/** Grenade in flight: [id, x, y, z] */
export type GrenadeSnapshot = [number, number, number, number];
/** Ability objects in the world: [id, kind, x, y, z, along (wall: 0 = runs along x, 1 = along z), team, owner]. */
export type DeployableKind = 'smoke' | 'mine' | 'wall';
export type DeployableSnapshot = [number, DeployableKind, number, number, number, number, Team, string];

export interface StateSnapshot {
  players: PlayerSnapshot[];
  ts: Record<SideTeam, number> | null;
  fl: Record<SideTeam, FlagSnapshot> | null;
  tg: TagSnapshot[] | null;
  inf: InfectSnapshot | null;
  gr: GrenadeSnapshot[];
  /** smoke clouds, mines and cover walls */
  dp: DeployableSnapshot[];
  dz: DomSnapshot[] | null;
  rd: RoundSnapshot | null;
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
  /** outfit colour (OUTFIT_COLORS) */
  color: string;
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
  medals: MedalId[];
}

export interface BestPlay {
  t: string;
  v: string;
  n: string;
}

/** A map + mode offered for the next match. */
export interface VoteOption {
  mapId: MapId;
  mode: ModeId;
}

export interface MatchEnd {
  winner: string;
  team: Team;
  scores: { name: string; kills: number; deaths: number; team: Team }[];
  best: BestPlay[];
  restartIn: number;
  /** options for the next match (empty: the same one again) */
  vote: VoteOption[];
  /** league tournament standings after this round */
  tour?: TournamentResult;
}

export type FlagEventType = 'take' | 'drop' | 'return' | 'capture';

/** All-time results of one player name, kept in the server's ranking file. */
export interface RankingRow {
  name: string;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  heads: number;
  medals: number;
  /** flag captures or confirmed tags */
  caps: number;
}

/** Session statistics of one player (server PC only). */
export interface SessionStatsRow {
  name: string;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  heads: number;
  medals: number;
  /** spawns per character */
  picks: Partial<Record<CharacterId, number>>;
}

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
  /** a shot stopped by Tanque's shield (id = the shield's owner) */
  'shield:hit': (d: { id: string; at: Vec3 }) => void;
  loadout: (d: { level: number; team?: Team }) => void;
  flag: (d: { type: FlagEventType; team?: SideTeam; name?: string }) => void;
  tag: (d: { type: 'confirm' | 'deny' }) => void;
  'match:end': (d: MatchEnd) => void;
  'match:start': () => void;
  /** a quick chat phrase (QUICK_CHAT index) */
  chat: (d: { name: string; team: Team; i: number }) => void;
  /** votes per option of the current vote */
  vote: (counts: number[]) => void;
  /** the room moved to another map / mode (end of match vote) */
  'room:changed': (room: RoomInfo) => void;
  /** a grenade exploded */
  boom: (d: { x: number; y: number; z: number }) => void;
  /** the admin removed you from the room (you are back in the lobby) */
  kicked: (reason: string) => void;
}

export interface ClientToServerEvents {
  'rooms:list': (cb: (rooms: RoomSummary[]) => void) => void;
  'room:create': (data: CreateRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:join': (data: JoinRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:leave': () => void;
  'net:ping': (d: { rtt: number }, cb: () => void) => void;
  'player:spawn': (d: { characterId: string; skin?: string; color?: string }) => void;
  'team:set': (d: { team: number }) => void;
  'player:input': (d: InputMessage) => void;
  'player:switch': (d: { slot: number }) => void;
  'player:reload': () => void;
  'player:shoot': (d: ShootMessage) => void;
  /** server PC only: practice bots */
  'bot:add': (d?: { level?: BotLevel }) => void;
  'bot:clear': () => void;
  'chat:quick': (d: { i: number }) => void;
  'player:grenade': (d: { o: Vec3; d: Vec3 }) => void;
  /** key E (the dash goes with the movement commands instead) */
  'player:ability': (d: { o: Vec3; d: Vec3 }) => void;
  vote: (d: { i: number }) => void;
  'admin:stats': (cb: (rows: SessionStatsRow[]) => void) => void;
  /** everybody: the ranking (best first) */
  'ranking:get': (cb: (rows: RankingRow[]) => void) => void;
  /** server PC only: room control */
  'admin:kick': (d: { id: string }) => void;
  'admin:kill': (d: { id: string }) => void;
  'admin:team': (d: { id: string }) => void;
  'admin:restart': () => void;
  'admin:end': () => void;
  'admin:room': (d: VoteOption) => void;
  'admin:lock': (d: { locked: boolean }) => void;
  'admin:ranking:reset': () => void;
  /** start a league of that many rounds (0 = stop it) */
  'tournament:set': (d: { rounds: number }) => void;
}
