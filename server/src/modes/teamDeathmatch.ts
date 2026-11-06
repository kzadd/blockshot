import { ZONE_PLANS } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import { smallerTeam } from '../players/teams';
import type { GameMode } from './gameMode';
import { asSide, scoreTeam } from './scoring';
import { shrinkingZone } from './zone';

// Red vs Blue: every kill scores for the killer's team. The zone closes and opens again in cycles, and while it
// is closed everybody respawns inside it.
export function createTeamDeathmatch(room: Room): GameMode {
  const zone = shrinkingZone(room, ZONE_PLANS.teams!);
  return {
    streakRewards: true,
    initialTeam: smallerTeam,
    onKill(r, shooter) {
      const team = asSide(shooter.team);
      if (team) scoreTeam(r, team);
    },
    tick: (_r, now) => zone.tick(now),
    filterSpawns: (_r, _p, spawns) => zone.spawns(spawns),
    onMatchReset: () => zone.stop(),
    snapshot: (_r, now) => ({ zn: zone.snapshot(now) }),
  };
}
