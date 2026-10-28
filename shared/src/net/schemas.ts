// Valibot schemas for every client → server message. The server drops (and logs) anything that does not match.
// Schemas check shape and types only; game rules (cooldowns, ranges, ammo…) are enforced by the server logic.
import * as v from 'valibot';
import { OUTFIT_COLOR_HEXES } from '../characters/characters';
import { CAMOS, FINISHES } from '../characters/looks';
import { VOTE_OPTIONS } from '../modes/modes';
import { QUICK_CHAT } from '../modes/quickChat';
import { TOUR_ROUNDS } from '../modes/tournament';

const finite = v.pipe(v.number(), v.finite());
const vec3 = v.tuple([finite, finite, finite]);
/** Generous upper bound for free text before the server trims it to its real limit. */
const TEXT_MAX = 200;
const text = v.pipe(v.string(), v.maxLength(TEXT_MAX));
/** No weapon fires more pellets than this in one shot. */
export const MAX_PELLETS = 16;

export const CreateRoomSchema = v.object({
  nickname: v.optional(text),
  name: v.optional(text),
  password: v.optional(text),
  mapId: v.optional(text),
  size: v.optional(text),
  mode: v.optional(text),
  scoreLimit: v.optional(finite),
  max: v.optional(finite),
});

export const JoinRoomSchema = v.object({
  roomId: text,
  nickname: v.optional(text),
  password: v.optional(text),
});

export const PingSchema = v.object({ rtt: v.optional(finite) });

export const SpawnSchema = v.object({
  characterId: text,
  skin: v.optional(text),
  /** outfit colour: one of OUTFIT_COLORS */
  color: v.optional(v.picklist(OUTFIT_COLOR_HEXES)),
  /** uniform camouflage and guns' finish: cosmetic picks (shared/characters/looks) */
  camo: v.optional(v.picklist(CAMOS.map((c) => c.id))),
  finish: v.optional(v.picklist(FINISHES.map((f) => f.id))),
});

export const TeamSetSchema = v.object({ team: finite });

/** Server PC only: the player an admin action is about (a socket id). */
export const AdminTargetSchema = v.object({ id: text });
/** Server PC only: move the room to this map and mode now (checked by the server). */
export const AdminRoomSchema = v.object({ mapId: text, mode: text });
export const AdminLockSchema = v.object({ locked: v.boolean() });
export const TournamentSchema = v.object({ rounds: v.picklist([0, ...TOUR_ROUNDS]) });

const int = v.pipe(v.number(), v.integer());
/** At most this many commands per batch (0.5 s worth): more means a flooding or broken client. */
export const MAX_INPUTS_PER_MESSAGE = 30;

export const MoveInputSchema = v.object({
  seq: v.pipe(int, v.minValue(0)),
  f: v.pipe(finite, v.minValue(-1), v.maxValue(1)),
  s: v.pipe(finite, v.minValue(-1), v.maxValue(1)),
  yaw: finite,
  pitch: finite,
  b: v.pipe(int, v.minValue(0)),
  slot: v.pipe(int, v.minValue(0)),
});

export const InputSchema = v.object({
  c: v.pipe(v.array(MoveInputSchema), v.minLength(1), v.maxLength(MAX_INPUTS_PER_MESSAGE)),
});

export const SwitchSchema = v.object({ slot: v.pipe(v.number(), v.integer()) });

export const ShootSchema = v.object({
  o: vec3,
  d: v.pipe(v.array(vec3), v.minLength(1), v.maxLength(MAX_PELLETS)),
  lag: v.optional(finite),
});

export const GrenadeSchema = v.object({ o: vec3, d: vec3 });
/** key E: eye and look direction (where the smoke is thrown / the wall goes) */
export const AbilitySchema = GrenadeSchema;

export const BotAddSchema = v.optional(v.object({ level: v.optional(v.picklist(['easy', 'normal', 'hard'])) }));

export const VoteSchema = v.object({ i: v.pipe(int, v.minValue(0), v.maxValue(VOTE_OPTIONS - 1)) });

export const QuickChatSchema = v.object({ i: v.pipe(int, v.minValue(0), v.maxValue(QUICK_CHAT.length - 1)) });

/** Messages without payload must not carry one either. */
export const EmptySchema = v.optional(v.union([v.undefined(), v.null(), v.object({})]));

export type CreateRoomInput = v.InferOutput<typeof CreateRoomSchema>;
export type JoinRoomInput = v.InferOutput<typeof JoinRoomSchema>;
export type SpawnInput = v.InferOutput<typeof SpawnSchema>;
export type InputBatch = v.InferOutput<typeof InputSchema>;
export type ShootInput = v.InferOutput<typeof ShootSchema>;

export { v };
