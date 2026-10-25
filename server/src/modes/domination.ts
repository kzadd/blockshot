// Domination: stand in a zone with no rival in it to turn it (an enemy zone goes neutral first). Every
// DOM.scoreEveryMs each team scores a point per zone it holds. Kills do not score.
import { DOM, TEAMS, ZONE_NAMES, dominationZones, type DomSnapshot, type SideTeam, type Team } from '@blockshot/shared';
import type { Player } from '../players/player';
import { smallerTeam } from '../players/teams';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { scoreTeam, teamSideSpawns } from './scoring';

interface Zone {
  /** +1 = fully Red, -1 = fully Blue, 0 = neutral */
  v: number;
  owner: Team;
  contested: boolean;
}

const newZones = (): Zone[] => ZONE_NAMES.map(() => ({ v: 0, owner: 0, contested: false }));
const PCT = 100;

export function createDomination(room: Room): GameMode {
  let zones = newZones();
  let lastTick = 0;
  let nextScore = 0;

  const inZone = (p: Player, [x, y, z]: readonly number[]) =>
    Math.hypot(p.x - x!, p.z - z!) < DOM.radius && Math.abs(p.y - y!) < DOM.height;

  function update(zone: Zone, i: number, dt: number): void {
    const centre = dominationZones(room.map)[i]!;
    const inside = [...room.players.values()].filter((p) => p.alive && p.team && inZone(p, centre));
    const red = inside.filter((p) => p.team === 1);
    const blue = inside.filter((p) => p.team === 2);
    zone.contested = red.length > 0 && blue.length > 0;
    const side: SideTeam | null = zone.contested ? null : red.length ? 1 : blue.length ? 2 : null;
    if (!side) {
      // Nobody (or both teams): an owned zone settles back to its owner, a neutral one stays as it is
      if (!zone.contested && zone.owner) zone.v = zone.owner === 1 ? 1 : -1;
      return;
    }
    const n = side === 1 ? red.length : blue.length;
    const speed = Math.min(DOM.maxBoost, 1 + (n - 1) * DOM.boostPerMate);
    const sign = side === 1 ? 1 : -1;
    const before = zone.v;
    zone.v = Math.max(-1, Math.min(1, zone.v + (sign * speed * dt) / DOM.captureMs));
    // Crossing the middle takes it from its owner; reaching the end gives it to the team in it
    if (zone.owner && zone.owner !== side && Math.sign(zone.v) !== Math.sign(before)) zone.owner = 0;
    if (Math.abs(zone.v) >= 1 && zone.owner !== side) {
      zone.owner = side;
      for (const p of side === 1 ? red : blue) p.caps++;
      notice(room, `Equipo ${TEAMS[side].name} captura la zona ${ZONE_NAMES[i]}`);
      room.channel.broadcast('flag', [{ type: 'capture', team: side }]); // same cue as a flag capture
    }
  }

  return {
    streakRewards: true,
    initialTeam: smallerTeam,
    onKill: () => {},
    filterSpawns: teamSideSpawns,
    tick(_room, now) {
      const dt = lastTick ? now - lastTick : 0;
      lastTick = now;
      zones.forEach((z, i) => update(z, i, dt));
      if (!nextScore) nextScore = now + DOM.scoreEveryMs;
      if (now < nextScore) return;
      nextScore = now + DOM.scoreEveryMs;
      for (const z of zones) {
        if (z.owner) scoreTeam(room, z.owner);
        if (room.matchOver) return;
      }
    },
    onMatchReset() {
      zones = newZones();
      lastTick = 0;
      nextScore = 0;
    },
    snapshot: () => ({
      dz: zones.map((z): DomSnapshot => [z.owner, Math.round(z.v * PCT), z.contested ? 1 : 0]),
    }),
  };
}
