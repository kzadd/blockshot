// Valibot schemas for every client → server message. The server drops (and logs) anything that does not match.
// Schemas check shape and types only; game rules (cooldowns, ranges, ammo…) are enforced by the server logic.
import * as v from 'valibot';

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
});

export const TeamSetSchema = v.object({ team: finite });

export const PlayerStateSchema = v.object({
  x: finite,
  y: finite,
  z: finite,
  ry: finite,
  rx: finite,
  sl: v.optional(finite),
  cr: v.optional(finite),
});

export const SwitchSchema = v.object({ slot: v.pipe(v.number(), v.integer()) });

export const ShootSchema = v.object({
  o: vec3,
  d: v.pipe(v.array(vec3), v.minLength(1), v.maxLength(MAX_PELLETS)),
  lag: v.optional(finite),
});

/** Messages without payload must not carry one either. */
export const EmptySchema = v.optional(v.union([v.undefined(), v.null(), v.object({})]));

export type CreateRoomInput = v.InferOutput<typeof CreateRoomSchema>;
export type JoinRoomInput = v.InferOutput<typeof JoinRoomSchema>;
export type SpawnInput = v.InferOutput<typeof SpawnSchema>;
export type PlayerStateInput = v.InferOutput<typeof PlayerStateSchema>;
export type ShootInput = v.InferOutput<typeof ShootSchema>;

export { v };
