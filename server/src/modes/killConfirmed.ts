// Every kill drops a tag in the victim's colour. A rival picking it up scores a point for its team;
// a teammate of the victim denies it. Tags vanish after TAG.lifeMs.
import { PICKUP_MAX_DY, TAG, floorBelow, round2, type SideTeam, type TagSnapshot } from '@blockshot/shared';
import { smallerTeam } from '../players/teams';
import type { Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { asSide, scoreTeam } from './scoring';

interface Tag {
  id: number;
  x: number;
  y: number;
  z: number;
  team: SideTeam;
  t: number;
}

/** Tags are dropped on the floor under the victim's chest, not on a roof above it. */
const DROP_PROBE_HEIGHT = 0.5;

export function createKillConfirmed(room: Room): GameMode {
  let tags: Tag[] = [];
  let seq = 0;

  return {
    streakRewards: true,
    initialTeam: smallerTeam,
    onKill(_room, _shooter, victim) {
      const team = asSide(victim.team);
      if (!team) return;
      seq++;
      const y = floorBelow(room.map.boxes, victim.x, victim.y + DROP_PROBE_HEIGHT, victim.z);
      tags.push({ id: seq, x: victim.x, y, z: victim.z, team, t: Date.now() });
    },
    tick(_room, now) {
      tags = tags.filter((g) => now - g.t < TAG.lifeMs);
      for (const p of room.players.values()) {
        if (!p.alive || !p.team) continue;
        const i = tags.findIndex(
          (g) => Math.hypot(p.x - g.x, p.z - g.z) < TAG.radius && Math.abs(p.y - g.y) < PICKUP_MAX_DY,
        );
        if (i < 0) continue;
        const [g] = tags.splice(i, 1);
        if (!g) continue;
        if (g.team === p.team) {
          room.channel.to(p.id, 'tag', [{ type: 'deny' }]);
          continue;
        }
        p.caps++;
        room.channel.to(p.id, 'tag', [{ type: 'confirm' }]);
        scoreTeam(room, p.team);
        if (room.matchOver) return;
      }
    },
    onMatchReset() {
      tags = [];
    },
    snapshot: () => ({
      tg: tags.map((g): TagSnapshot => [g.id, round2(g.x), round2(g.y), round2(g.z), g.team]),
    }),
  };
}
