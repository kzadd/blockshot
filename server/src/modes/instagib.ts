// InstaGib: free for all where everybody carries only the railgun (endless ammo, see `unlimitedAmmo`) and the
// knife. The railgun kills in one hit anywhere. No power weapons, grenades nor streak rewards. First to the kill
// limit wins.
import { WEAPONS } from '@blockshot/shared';
import { endMatch } from '../match/match';
import type { GameMode } from './gameMode';

export const createInstagib = (): GameMode => ({
  streakRewards: false,
  powerWeapons: false,
  initialTeam: () => 0,
  // Enough to go through any health and armour
  damage: (_shooter, victim, w, dmg) =>
    w === WEAPONS.railgun ? Math.max(dmg, Math.ceil(victim.hp + victim.armor)) : dmg,
  onKill(room, shooter) {
    if (shooter.kills >= room.scoreLimit) endMatch(room, shooter.name);
  },
});
