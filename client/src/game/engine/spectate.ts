// Spectating while dead in the round modes: who you may watch and how the watched player is picked.
import type { RoundSnapshot, Team } from '@blockshot/shared';

/** What the rules need to know about each player (snapshot order is the cycling order). */
export interface SpectateCandidate {
  id: string;
  /** alive (snapshot `a`) */
  a: number;
  /** team (snapshot `tm`) */
  tm: Team;
}

export interface SpectateRules {
  myId: string;
  myTeam: Team;
  /** team mode: only living teammates can be watched (never an enemy: no free intel for the team) */
  teams: boolean;
}

/** Dead with no respawn until the round ends (or a teammate thaws you): the camera follows someone. */
export function shouldSpectate(alive: boolean, everSpawned: boolean, round: RoundSnapshot | null): boolean {
  return !alive && everSpawned && round?.p === 1;
}

export function canWatch(p: SpectateCandidate, rules: SpectateRules): boolean {
  return p.id !== rules.myId && !!p.a && (!rules.teams || p.tm === rules.myTeam);
}

/**
 * The player to watch: `dir` 0 keeps `current` while it can still be watched, 1 / -1 step to the next /
 * previous one (wrapping around). When `current` died the next one after its place is picked. null: nobody.
 */
export function pickTarget(
  players: readonly SpectateCandidate[],
  current: string | null,
  dir: -1 | 0 | 1,
  rules: SpectateRules,
): string | null {
  const n = players.length;
  if (!n) return null;
  const at = current === null ? -1 : players.findIndex((p) => p.id === current);
  if (dir === 0 && at >= 0 && canWatch(players[at]!, rules)) return current;
  const step = dir === -1 ? -1 : 1;
  // Not in the list (or none yet): start before the first one going forwards, after the last going back
  const from = at >= 0 ? at : step === 1 ? -1 : n;
  for (let i = 1; i <= n; i++) {
    const p = players[(((from + step * i) % n) + n) % n]!;
    if (canWatch(p, rules)) return p.id;
  }
  return null;
}
