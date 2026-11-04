// Bomba (Bomb & Defuse): rounds without respawning. Red attacks, Blue defends two sites (A north, B south) on
// Blue's half. One Red player carries the bomb (dropped where he dies, any Red picks it up by walking over it);
// standing BOMB.plantMs inside a site plants it, and it explodes BOMB.fuseMs later: Red wins the round. A Blue
// player standing next to it for BOMB.defuseMs defuses it: Blue wins. Red also wins if every Blue is dead; Blue
// wins if every Red is dead before the plant, or if time runs out without a plant.
import { BOMB, PICKUP_MAX_DY, SITE_NAMES, bombSites, floorBelow, round2, type SideTeam } from '@blockshot/shared';
import type { Player } from '../players/player';
import { smallerTeam } from '../players/teams';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { endTeamRound, roundPhases, teamsReady } from './roundPhases';
import { teamSideSpawns } from './scoring';

interface Bomb {
  carrier: string | null;
  carrierName: string;
  x: number;
  y: number;
  z: number;
  planted: boolean;
  /** site it is planted at, or being planted at (-1: none) */
  site: number;
  /** plant and defuse progress, 0…1 */
  plant: number;
  defuse: number;
  explodeAt: number;
}

const PCT = 100;
const near = (p: Player, x: number, y: number, z: number, r: number) =>
  Math.hypot(p.x - x, p.z - z) < r && Math.abs(p.y - y) < PICKUP_MAX_DY;

export function createBomb(room: Room): GameMode {
  let bomb: Bomb | null = null;
  let lastTick = 0;

  const members = (t: SideTeam) => [...room.players.values()].filter((p) => p.team === t);
  const alive = (t: SideTeam) => members(t).filter((p) => p.alive);

  function endRound(winner: SideTeam | null, now: number): void {
    bomb = null;
    endTeamRound(room, phases, winner, now);
  }

  const phases = roundPhases(room, {
    ready: () => teamsReady(room),
    // Time is up: Blue held the sites, unless the bomb is ticking (then it decides)
    timeUp: (now) => {
      if (!bomb?.planted) endRound(2, now);
    },
    started: () => {
      bomb = null;
    },
  });

  /** Somebody's team is out of players alive. */
  function checkRound(now: number): void {
    if (!phases.playing()) return;
    const red = alive(1).length;
    const blue = alive(2).length;
    const planted = !!bomb?.planted;
    if (!red && !blue && !planted) endRound(null, now);
    else if (!blue) endRound(1, now);
    else if (!red && !planted) endRound(2, now);
  }

  /** The bomb goes to a random living Red player (start of the round, or nobody had it). */
  function handOut(): void {
    const reds = alive(1);
    const p = reds[Math.floor(Math.random() * reds.length)];
    if (!p) return;
    bomb = {
      carrier: p.id,
      carrierName: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      planted: false,
      site: -1,
      plant: 0,
      defuse: 0,
      explodeAt: 0,
    };
    room.channel.to(p.id, 'notice', ['Llevas la bomba: plántala en A o B']);
  }

  function carry(b: Bomb, dt: number, now: number): void {
    const c = b.carrier ? room.players.get(b.carrier) : null;
    if (!c || !c.alive || c.team !== 1) {
      // The carrier died, left or switched teams: the bomb drops where it was
      Object.assign(b, { carrier: null, y: floorBelow(room.map.boxes, b.x, b.y, b.z), site: -1, plant: 0 });
      notice(room, `${c?.name ?? b.carrierName} soltó la bomba`);
      return;
    }
    Object.assign(b, { x: c.x, y: c.y, z: c.z });
    const site = bombSites(room.map).findIndex(([x, y, z]) => near(c, x, y, z, BOMB.siteRadius));
    if (site !== b.site) Object.assign(b, { site, plant: 0 });
    if (site < 0) return;
    b.plant += dt / BOMB.plantMs;
    if (b.plant < 1) return;
    Object.assign(b, { carrier: null, planted: true, explodeAt: now + BOMB.fuseMs });
    c.caps++;
    notice(room, `¡Bomba plantada en ${SITE_NAMES[site]}!`);
    room.channel.broadcast('flag', [{ type: 'take', team: 2, name: c.name }]); // same cue as a flag taken
  }

  function update(b: Bomb, dt: number, now: number): void {
    if (b.carrier) return carry(b, dt, now);
    if (!b.planted) {
      const p = alive(1).find((r) => near(r, b.x, b.y, b.z, BOMB.pickup));
      if (p) Object.assign(b, { carrier: p.id, carrierName: p.name });
      return;
    }
    if (now >= b.explodeAt) {
      notice(room, '¡La bomba ha explotado!');
      return endRound(1, now);
    }
    const defuser = alive(2).find((p) => near(p, b.x, b.y, b.z, BOMB.defuseRadius));
    b.defuse = defuser ? b.defuse + dt / BOMB.defuseMs : 0;
    if (!defuser || b.defuse < 1) return;
    defuser.caps++;
    notice(room, `Bomba desactivada por ${defuser.name}`);
    endRound(2, now);
  }

  return {
    streakRewards: false,
    initialTeam: smallerTeam,
    filterSpawns: teamSideSpawns,
    canSpawn: () => !phases.playing(),
    teamsLocked: () => phases.playing(),
    onKill: () => checkRound(Date.now()),
    onDeath: () => checkRound(Date.now()),
    tick(_room, now) {
      const dt = lastTick ? now - lastTick : 0;
      lastTick = now;
      phases.tick(now);
      if (!phases.playing()) return;
      if (!bomb) handOut();
      if (bomb) update(bomb, dt, now);
      checkRound(now);
    },
    onMatchReset() {
      phases.reset();
      bomb = null;
      lastTick = 0;
    },
    snapshot: (_room, now) => ({
      rd: phases.snapshot(now),
      bm: bomb && {
        st: bomb.planted ? 2 : bomb.carrier ? 0 : 1,
        c: bomb.carrier,
        x: round2(bomb.x),
        y: round2(bomb.y),
        z: round2(bomb.z),
        s: bomb.site,
        pp: Math.round(bomb.plant * PCT),
        dp: Math.round(bomb.defuse * PCT),
        t: bomb.planted ? Math.max(0, bomb.explodeAt - now) : 0,
      },
    }),
  };
}
