// Congelados (Freeze Tag): Red against Blue. A player who dies is frozen instead: he stays dead (no respawn) and
// his body is a statue where he fell. A living teammate standing next to the statue for FREEZE.thawMs (faster with
// more teammates) thaws him: he comes back right there, with full health and spawn protection. When a whole team
// is frozen the other one wins the round; when time runs out, the team with fewer frozen players wins it.
import { FREEZE, PICKUP_MAX_DY, round2, type IceSnapshot, type SideTeam, type Spawn } from '@blockshot/shared';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { smallerTeam } from '../players/teams';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { endTeamRound, roundPhases, teamsReady } from './roundPhases';
import { asSide, teamSideSpawns } from './scoring';

interface Statue {
  x: number;
  y: number;
  z: number;
  ry: number;
  team: SideTeam;
  /** thaw progress 0…1 */
  v: number;
}

const PCT = 100;

export function createFreezeTag(room: Room): GameMode {
  /** frozen players by id */
  const statues = new Map<string, Statue>();
  /** where a player being thawed comes back (read by filterSpawns while he respawns) */
  const thawSpot = new Map<string, Spawn>();
  /** players frozen this round and not thawed: no respawn until the next round, statue or not */
  const out = new Set<string>();
  let lastTick = 0;

  const members = (t: SideTeam) => [...room.players.values()].filter((p) => p.team === t);
  const frozen = (t: SideTeam) => members(t).filter((p) => statues.has(p.id)).length;

  /** Time is up: fewer frozen players wins. */
  function timeUp(now: number): void {
    const red = frozen(1);
    const blue = frozen(2);
    endRound(red === blue ? null : red < blue ? 1 : 2, now);
  }

  function endRound(winner: SideTeam | null, now: number): void {
    statues.clear();
    endTeamRound(room, phases, winner, now);
  }

  const phases = roundPhases(room, {
    ready: () => teamsReady(room),
    timeUp,
    started: () => {
      statues.clear();
      out.clear();
    },
  });

  /** A whole team frozen: the other one wins the round. */
  function checkRound(now: number): void {
    if (!phases.playing()) return;
    const out = ([1, 2] as const).filter((t) => members(t).length > 0 && frozen(t) === members(t).length);
    if (out.length) endRound(out.length === 2 ? null : out[0] === 1 ? 2 : 1, now);
  }

  function thaw(p: Player, s: Statue, by: Player[]): void {
    statues.delete(p.id);
    out.delete(p.id);
    if (!p.cls) return;
    thawSpot.set(p.id, [s.x, s.y, s.z, s.ry]);
    spawnPlayer(room, p);
    thawSpot.delete(p.id);
    for (const m of by) m.caps++;
    notice(room, `${by.map((m) => m.name).join(' y ')} ${by.length > 1 ? 'descongelaron' : 'descongeló'} a ${p.name}`);
  }

  function updateStatues(dt: number): void {
    for (const [id, s] of statues) {
      const p = room.players.get(id);
      // Left, switched team or came back some other way: no statue
      if (!p || p.alive || p.team !== s.team) {
        statues.delete(id);
        continue;
      }
      const mates = [...room.players.values()].filter(
        (m) =>
          m.alive &&
          m.team === s.team &&
          Math.hypot(m.x - s.x, m.z - s.z) < FREEZE.radius &&
          Math.abs(m.y - s.y) < PICKUP_MAX_DY,
      );
      if (!mates.length) {
        s.v = 0;
        continue;
      }
      const speed = Math.min(FREEZE.maxBoost, 1 + (mates.length - 1) * FREEZE.boostPerMate);
      s.v += (speed * dt) / FREEZE.thawMs;
      if (s.v >= 1) thaw(p, s, mates);
    }
  }

  return {
    streakRewards: false,
    initialTeam: smallerTeam,
    filterSpawns: (r, p, spawns) => {
      const spot = thawSpot.get(p.id);
      return spot ? [spot] : teamSideSpawns(r, p, spawns);
    },
    // Frozen players wait for a teammate; anyone else (just joined, between rounds) may respawn
    canSpawn: (_room, p) => !(phases.playing() && out.has(p.id)),
    teamsLocked: () => phases.playing(),
    onKill(r, _shooter, victim) {
      this.onDeath!(r, victim);
    },
    onDeath(_room, victim) {
      const team = asSide(victim.team);
      if (!phases.playing() || !team) return;
      statues.set(victim.id, { x: victim.x, y: victim.y, z: victim.z, ry: victim.ry, team, v: 0 });
      out.add(victim.id);
      notice(room, `${victim.name} está congelado`);
      checkRound(Date.now());
    },
    tick(_room, now) {
      const dt = lastTick ? now - lastTick : 0;
      lastTick = now;
      phases.tick(now);
      // Waiting for players or between rounds: nobody stays frozen
      if (!phases.playing()) return statues.clear();
      updateStatues(dt);
      checkRound(now);
    },
    onMatchReset() {
      phases.reset();
      statues.clear();
      out.clear();
      lastTick = 0;
    },
    snapshot: (_room, now) => ({
      rd: phases.snapshot(now),
      ic: [...statues].map(([id, s]): IceSnapshot => [
        id,
        round2(s.x),
        round2(s.y),
        round2(s.z),
        s.team,
        Math.round(s.v * PCT),
      ]),
    }),
  };
}
