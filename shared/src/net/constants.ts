/** Server snapshots per second = 1000 / SERVER_TICK_MS (mode rules and regeneration run at this rate too) */
export const SERVER_TICK_MS = 50;
/** Movement is simulated this many times per snapshot (60 Hz with 50 ms snapshots). */
export const SIM_STEPS_PER_TICK = 3;
/** Simulation time a player may bank to absorb network jitter (s); more queued input waits. */
export const MAX_SIM_BUDGET_S = 0.25;
/** Commands waiting beyond this are dropped (a client sending faster than real time). */
export const MAX_QUEUED_INPUTS = 60;
/** The client may be ahead of the server by this much when it shoots (s): widens the origin check. */
export const MAX_INPUT_DELAY_S = 0.25;
/** Client state sends per second = 1000 / CLIENT_SEND_MS */
export const CLIENT_SEND_MS = 50;
/** How far back the server rewinds players to check a shot. */
export const LAG_COMP_MAX_MS = 250;
/** Position history kept per player for lag compensation. */
export const LAG_HISTORY_MS = 1000;
/** Remote players are drawn this far in the past (snapshot interval + smoothing); added to the ping when rewinding. */
export const VIEW_DELAY_MS = 100;
/** Client ping measurement interval. */
export const PING_INTERVAL_MS = 2000;
export const MAX_PING_MS = 999;

/** Shot origin may differ this much from the server's eye position (m). */
export const SHOT_ORIGIN_TOLERANCE = 3;
/** Fire-rate check tolerates this fraction of the weapon's fireRate (network jitter). */
export const FIRE_RATE_TOLERANCE = 0.8;
/** A reload counts as finished this early (ms) when the next shot arrives. */
export const RELOAD_GRACE_MS = 150;
/** Shot direction vectors must be unit length within this tolerance. */
export const DIRECTION_LENGTH_TOLERANCE = 0.1;
/** A spawn request may arrive this early before the respawn delay ends (ms). */
export const SPAWN_REQUEST_GRACE_MS = 300;

export const NICKNAME_MAX = 16;
export const ROOM_NAME_MAX = 24;
export const PASSWORD_MAX = 32;
export const ROOM_MIN_PLAYERS = 2;
export const ROOM_MAX_PLAYERS = 24;
export const DEFAULT_PORT = 3000;
