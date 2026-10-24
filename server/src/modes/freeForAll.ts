import { endMatch } from '../match/match';
import type { GameMode } from './gameMode';

// First player to reach the kill limit wins
export const createFreeForAll = (): GameMode => ({
  streakRewards: true,
  initialTeam: () => 0,
  onKill(room, shooter) {
    if (shooter.kills >= room.scoreLimit) endMatch(room, shooter.name);
  },
});
