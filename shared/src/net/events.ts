// Typed Socket.IO protocol. Short keys in high-frequency payloads keep snapshots small.
import type { Vec3 } from '../core/math';
import type { AbilityId } from '../abilities/abilities';
import type { AccessoryId } from '../characters/accessories';
import type { PlayerClass, SkinId } from '../characters/characters';
import type { CamoId, FinishId } from '../characters/looks';
import type { TournamentResult } from '../modes/tournament';
import type { MapId, PickupKind, SizeId } from '../maps/types';
import type { BotLevel } from '../modes/bots';
import type { MedalId } from '../modes/medals';
import type { ZombieKind } from '../modes/infect';
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
  /** the class's ability (key E); null before the player's first spawn (no class yet) */
  ab: AbilityId | null;
  /** skin */
  sk: SkinId;
  /** outfit colour picked by the player (OUTFIT_COLORS) */
  co: string;
  /** uniform camouflage */
  cm: CamoId;
  /** guns' finish */
  fn: FinishId;
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
  /** power weapon held (it takes the slot after the normal ones), null: none */
  pw: WeaponId | null;
  /** loadout pick: index of the primary and the secondary in the character's primaries / secondaries */
  wc: [number, number];
  /** the class's accessory (others see the vest, the laser, the suppressor); null before the first spawn */
  ax: AccessoryId | null;
  /** 1: caught camping, rivals see it on their minimap until it leaves the zone (anti-camping) */
  camp?: number;
  /** rank points from the all-time ranking (none for bots and newcomers) */
  rp?: number;
  /** 1: aiming (right button): the death replay and spectators see the sight as the player did */
  ad?: number;
  /** Infectados: the infected's type (none for survivors) */
  zt?: ZombieKind;
  /** the mode's walking speed factor when it is not 1 (infected types, the scream's slow): the client predicts with it */
  sf?: number;
  /** ms until the mode's key F is ready again (Infectados: barricade or scream); absent: the mode has none */
  fc?: number;
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
  /** 1 in the last stretch: the infected see every survivor on their minimap */
  rv?: number;
  /** the last survivor (everybody sees him on the minimap) */
  ls?: string;
  /** 1 while his announcement is on screen (LAST_STAND.bannerMs) */
  la?: number;
  /** blackout: 1 about to start (warning), 2 lights out */
  bo?: 1 | 2;
}

/** Traidores: what everybody may know (never the roles: those go to each player alone, `traitor:role`). */
export interface TraitorSnapshot {
  /** bodies lying where they fell: [player id, x, y, z] */
  bd: [string, number, number, number][];
  /** a meeting is on: ms left, who called it, whose body was found ('' for an emergency), who already voted */
  mt?: { t: number; by: string; body: string; vd: string[] };
}

/** Domination zone: [owner, capture -100 (Blue) … 100 (Red), contested] */
export type DomSnapshot = [Team, number, number];

/** Rounds: phase (0 waiting for players, 1 playing, 2 break), round number, ms left in the phase. */
export interface RoundSnapshot {
  p: 0 | 1 | 2;
  n: number;
  t: number;
}

/** Freeze tag statue (a frozen player): [player id, x, y, z, team, thaw progress 0…100]. */
export type IceSnapshot = [string, number, number, number, SideTeam, number];

/** Bomb: where it is (carried: the carrier's feet), plant / defuse progress and the fuse. */
export interface BombSnapshot {
  /** 0 carried, 1 dropped on the floor, 2 planted */
  st: 0 | 1 | 2;
  /** carrier id (st 0) */
  c: string | null;
  x: number;
  y: number;
  z: number;
  /** site it is planted at, or being planted at (0 = A, 1 = B, -1 none) */
  s: number;
  /** plant progress 0…100 */
  pp: number;
  /** defuse progress 0…100 */
  dp: number;
  /** ms until it explodes (planted), 0 otherwise */
  t: number;
}

/** Shrinking zone: [centre x, ground y, centre z, radius]. */
export type ZoneSnapshot = [number, number, number, number];

/** Grenade in flight: [id, x, y, z] */
export type GrenadeSnapshot = [number, number, number, number];
/** Ability objects in the world: [id, kind, x, y, z, along (wall: 0 = runs along x, 1 = along z), team, owner]. */
export type DeployableKind = 'smoke' | 'mine' | 'wall' | 'plank';
export type DeployableSnapshot = [number, DeployableKind, number, number, number, number, Team, string];

/** Map objects not there right now (indices): [fallen barrels, broken crates, taken pickups]. */
/** [fallen barrels, broken crates, taken pickups, dropped tiles, shaking tiles] */
export type ObjectsSnapshot = [number[], number[], number[], number[], number[]];

export interface StateSnapshot {
  players: PlayerSnapshot[];
  ts: Record<SideTeam, number> | null;
  fl: Record<SideTeam, FlagSnapshot> | null;
  tg: TagSnapshot[] | null;
  inf: InfectSnapshot | null;
  gr: GrenadeSnapshot[];
  /** smoke clouds, mines and cover walls */
  dp: DeployableSnapshot[];
  /** barrels, crates and pickups that are gone for now */
  wo: ObjectsSnapshot;
  /** server time (ms) when the snapshot was taken: clients run the moving obstacles on it */
  t: number;
  /** the power weapon lying on the map: [spot index into map.powerSpots, weapon] (null: none now) */
  pw: [number, WeaponId] | null;
  dz: DomSnapshot[] | null;
  rd: RoundSnapshot | null;
  /** freeze tag: frozen players */
  ic: IceSnapshot[] | null;
  /** bomb mode: the bomb */
  bm: BombSnapshot | null;
  /** shrinking zone (Supervivencia, Último en pie, Por equipos) */
  zn: ZoneSnapshot | null;
  /** Traidores: bodies and the meeting */
  tt: TraitorSnapshot | null;
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
  skin: SkinId;
  /** outfit colour (OUTFIT_COLORS) */
  color: string;
  camo: CamoId;
  finish: FinishId;
  /** the class the server equipped (the player's pick, validated) */
  primary: WeaponId;
  secondary: WeaponId;
  ability: AbilityId;
  accessory: AccessoryId;
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
  /** the killer's class (null for the world or a kill outside a class, like a forced respawn) */
  killerClass: PlayerClass | null;
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
  /** most-carried primary weapon (null before the first spawn was recorded) */
  fav: WeaponId | null;
  /** outfit colour last worn ('' if unknown) */
  favColor: string;
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
  /** spawns per primary weapon carried */
  picks: Partial<Record<WeaponId, number>>;
}

export interface ServerToClientEvents {
  rooms: (rooms: RoomSummary[]) => void;
  notice: (text: string) => void;
  state: (s: StateSnapshot) => void;
  'player:spawned': (d: SpawnedMessage) => void;
  'player:ack': (d: AckMessage) => void;
  damaged: (d: { hp: number; from: [number, number] }) => void;
  /** `id`: who was hit (tactical goggles mark them on the minimap) */
  hitmarker: (d: { head: boolean; kill: boolean; dmg: number; at: Vec3; id?: string }) => void;
  kill: (d: KillEvent) => void;
  /** a shot (`s`: silenced: no minimap mark, a muffled sound) */
  shot: (d: { id: string; w: WeaponId | null; e: Vec3[]; s?: 1 }) => void;
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
  /** an air strike is coming down on these points in `ms` */
  strike: (d: { at: Vec3[]; ms: number }) => void;
  /** a wooden crate broke (index into map.crates and its centre, for the splinters) */
  crate: (d: { i: number; x: number; y: number; z: number }) => void;
  /** you picked up health or armour */
  pickup: (k: PickupKind | 'power') => void;
  /** a moving obstacle knocked you this way (x, z) */
  knocked: (d: { x: number; z: number }) => void;
  /** Paciente cero's scream at `at`: `hit` are the survivors it slowed (their screen shakes) */
  scream: (d: { id: string; at: Vec3; hit: string[] }) => void;
  /** the admin removed you from the room (you are back in the lobby) */
  kicked: (reason: string) => void;
  /** Traidores, to each player alone at the start of a round: its role, and (traitors only) the other traitors */
  'traitor:role': (d: { traitor: boolean; mates: string[] }) => void;
}

export interface ClientToServerEvents {
  'rooms:list': (cb: (rooms: RoomSummary[]) => void) => void;
  'room:create': (data: CreateRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:join': (data: JoinRoomRequest, cb: (res: JoinResult) => void) => void;
  'room:leave': () => void;
  'net:ping': (d: { rtt: number }, cb: () => void) => void;
  'player:spawn': (d: {
    /** older clients still send it: ignored */
    characterId?: string;
    skin?: string;
    color?: string;
    camo?: string;
    finish?: string;
    primary?: string;
    secondary?: string;
    ability?: string;
    accessory?: string;
  }) => void;
  /** the in-match loadout menu: the class to take at the next respawn (checked then, like a spawn request) */
  'player:class': (d: { primary?: string; secondary?: string; ability?: string; accessory?: string }) => void;
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
  /** key F: the mode's action (Infectados: a survivor's barricade, the Paciente cero's scream) */
  'player:action': (d: { o: Vec3; d: Vec3 }) => void;
  /** Infectados: the infected type to respawn as (ZombieType; anything else: back to rotating) */
  'infect:pick': (d: { z: string }) => void;
  vote: (d: { i: number }) => void;
  /** Traidores: vote in the meeting (a player id, '' to skip) */
  'traitor:vote': (d: { id: string }) => void;
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
  'tournament:set': (d: { rounds: number; mode?: ModeId }) => void;
}
