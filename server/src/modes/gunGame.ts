import { gunLadder } from '@blockshot/shared';
import { endMatch } from '../match/match';
import { equip } from '../players/loadout';
import { notice } from '../rooms/room';
import type { GameMode } from './gameMode';

// Each kill gives the next weapon; a kill with the last one (the knife) wins.
// A knife kill also takes a weapon from the victim.
export const createGunGame = (): GameMode => ({
  streakRewards: true,
  initialTeam: () => 0,
  onKill(room, shooter, victim, w) {
    const ladder = gunLadder(room.scoreLimit);
    if (w.melee && victim.level > 0) {
      victim.level--;
      equip(room, victim);
      room.channel.to(victim.id, 'loadout', [{ level: victim.level }]);
      notice(room, `${victim.name} baja al arma ${victim.level + 1} por un cuchillazo`);
    }
    shooter.level++;
    if (shooter.level >= ladder.length) return endMatch(room, shooter.name);
    equip(room, shooter);
    room.channel.to(shooter.id, 'loadout', [{ level: shooter.level }]);
    if (shooter.level === ladder.length - 1) notice(room, `¡${shooter.name} llegó al cuchillo!`);
  },
});
