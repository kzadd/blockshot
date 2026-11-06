// Who gets to see which mode objective (pure rules shared by the 3D markers, the minimap and the HUD).
import { FREEZE, type BombSnapshot, type IceSnapshot, type ModeId, type Team } from '@blockshot/shared';

/** Bomb mode: Red always attacks (server/src/modes/bomb.ts). */
export const BOMB_ATTACKERS: Team = 1;

/** Modes with one life per round: the scoreboard tells who is still standing. */
export const oneLife = (mode: ModeId): boolean =>
  mode === 'rounds' || mode === 'lms' || mode === 'freeze' || mode === 'bomb';

/**
 * Whether my team sees where the bomb is (through walls and on the minimap): a carried bomb only the carrier's
 * team, a dropped one the attackers (who can pick it up), a planted one everybody.
 */
export function bombSeen(b: BombSnapshot, myTeam: Team, carrierTeam: Team | undefined): boolean {
  if (b.st === 2) return true;
  if (b.st === 1) return myTeam === BOMB_ATTACKERS;
  return carrierTeam !== undefined && carrierTeam === myTeam;
}

/** Freeze tag: the frozen teammate I am standing next to (the server thaws within FREEZE.radius), or null. */
export function thawTarget(ice: readonly IceSnapshot[], myTeam: Team, x: number, z: number): IceSnapshot | null {
  let best: IceSnapshot | null = null;
  let bestD = FREEZE.radius;
  for (const s of ice) {
    const d = Math.hypot(s[1] - x, s[3] - z);
    if (s[4] === myTeam && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
