import { RACE_FALL_Y, type Spawn } from '@blockshot/shared';
import { endMatch } from '../match/match';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';

/** A checkpoint counts from a little under its floor to well above it (m). */
const CP_BELOW = 0.5;
const CP_ABOVE = 3;

// Carrera (Fall Guys with guns): everybody races the course through its checkpoints; falling into the lava or
// being killed sends you back to the last one you reached. The first to the finish wins the race (a point, shown in
// the scoreboard's own column) and everybody starts the next one; the first to the race limit wins the match.
export function createRace(): GameMode {
  /** checkpoints reached by each player in the current race */
  const reached = new Map<string, number>();

  /** Back to the last checkpoint (or the start), full health: a respawn without a death. */
  const sendBack = (room: Room, p: Player) => {
    if (!p.cls) return;
    spawnPlayer(room, p);
  };

  return {
    streakRewards: false,
    initialTeam: () => 0,
    onKill() {
      // Kills do not score: they only cost the victim the way back from their checkpoint
    },
    filterSpawns(room, p, spawns): Spawn[] {
      const n = reached.get(p.id) ?? 0;
      const cps = room.map.checkpoints;
      const c = n > 0 ? cps[n - 1] : undefined;
      if (!c) return spawns;
      // On the checkpoint, looking towards the next one
      const next = cps[n] ?? c;
      const yaw = Math.atan2(-(next.x - c.x), -(next.z - c.z));
      const j = () => (Math.random() - 0.5) * Math.min(c.w, c.d) * 0.5;
      return [[c.x + j(), c.y, c.z + j(), yaw]];
    },
    onMatchReset: () => reached.clear(),
    tick(room, now) {
      void now;
      const cps = room.map.checkpoints;
      for (const p of room.players.values()) {
        if (!p.alive) continue;
        if (p.y < RACE_FALL_Y) {
          sendBack(room, p);
          continue;
        }
        const n = reached.get(p.id) ?? 0;
        const c = cps[n];
        if (
          !c ||
          Math.abs(p.x - c.x) > c.w / 2 ||
          Math.abs(p.z - c.z) > c.d / 2 ||
          p.y < c.y - CP_BELOW ||
          p.y > c.y + CP_ABOVE
        )
          continue;
        reached.set(p.id, n + 1);
        if (n + 1 < cps.length) {
          room.channel.to(p.id, 'notice', [`Punto de control ${n + 1} de ${cps.length - 1}`]);
          continue;
        }
        // Finish line
        p.caps++;
        if (p.caps >= room.scoreLimit) return endMatch(room, p.name);
        notice(room, `¡${p.name} gana la carrera! (${p.caps} de ${room.scoreLimit}) · ¡Otra vez desde la salida!`);
        reached.clear();
        for (const q of room.players.values()) if (q.alive) sendBack(room, q);
        return;
      }
    },
  };
}
