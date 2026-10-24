import { smallerTeam } from '../players/teams';
import type { GameMode } from './gameMode';
import { asSide, scoreTeam } from './scoring';

// Red vs Blue: every kill scores for the killer's team
export const createTeamDeathmatch = (): GameMode => ({
  streakRewards: true,
  initialTeam: smallerTeam,
  onKill(room, shooter) {
    const team = asSide(shooter.team);
    if (team) scoreTeam(room, team);
  },
});
