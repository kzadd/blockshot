// Each team has a flag at its base. Walk over the enemy flag to take it and bring it to your base,
// with your own flag at home, to capture. If the carrier dies the flag drops: a teammate of its
// owner returns it by touching it, otherwise it returns by itself after FLAG.returnMs.
import {
  FLAG,
  PICKUP_MAX_DY,
  TEAMS,
  floorBelow,
  round2,
  type FlagEventType,
  type FlagSnapshot,
  type SideTeam,
  type Vec3,
} from '@blockshot/shared';
import type { Player } from '../players/player';
import { smallerTeam } from '../players/teams';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { scoreTeam } from './scoring';

interface Flag {
  home: Vec3;
  x: number;
  y: number;
  z: number;
  carrier: string | null;
  carrierName?: string;
  atHome: boolean;
  droppedAt: number;
}

const SIDES: SideTeam[] = [1, 2];
const other = (t: SideTeam): SideTeam => (t === 1 ? 2 : 1);
const homeFlag = ([x, y, z]: Vec3): Flag => ({ home: [x, y, z], x, y, z, carrier: null, atHome: true, droppedAt: 0 });
const nearFlag = (p: Player, x: number, y: number, z: number) =>
  Math.hypot(p.x - x, p.z - z) < FLAG.radius && Math.abs(p.y - y) < PICKUP_MAX_DY;
const flagSnapshot = (f: Flag): FlagSnapshot => ({
  x: round2(f.x),
  y: round2(f.y),
  z: round2(f.z),
  c: f.carrier,
  h: f.atHome ? 1 : 0,
});

export function createCaptureTheFlag(room: Room): GameMode {
  const newFlags = (): Record<SideTeam, Flag> => ({ 1: homeFlag(room.map.bases[1]), 2: homeFlag(room.map.bases[2]) });
  let flags = newFlags();
  const event = (type: FlagEventType, team: SideTeam, name?: string) =>
    room.channel.broadcast('flag', [{ type, team, ...(name !== undefined ? { name } : {}) }]);

  function updateCarriedFlags(now: number): void {
    for (const t of SIDES) {
      const f = flags[t];
      if (f.carrier) {
        const c = room.players.get(f.carrier);
        if (c && c.alive && c.team !== t) {
          Object.assign(f, { x: c.x, y: c.y, z: c.z });
          continue;
        }
        // The carrier died, left or switched teams: the flag drops where it was
        Object.assign(f, { carrier: null, y: floorBelow(room.map.boxes, f.x, f.y, f.z), droppedAt: now });
        const name = c?.name ?? f.carrierName;
        notice(room, `${name} soltó la bandera ${TEAMS[t].name}`);
        event('drop', t, name);
      } else if (!f.atHome && now - f.droppedAt > FLAG.returnMs) {
        flags[t] = homeFlag(f.home);
        notice(room, `La bandera ${TEAMS[t].name} volvió a su base`);
        event('return', t);
      }
    }
  }

  return {
    streakRewards: true,
    initialTeam: smallerTeam,
    onKill: () => {}, // kills do not score: only captures do
    // Each team spawns in its own half (Red west, Blue east)
    filterSpawns(_room, p, spawns) {
      if (!p.team) return spawns;
      const mine = spawns.filter((s) => (p.team === 1 ? s[0] < -1 : s[0] > 1));
      return mine.length ? mine : spawns;
    },
    tick(_room, now) {
      updateCarriedFlags(now);
      for (const p of room.players.values()) {
        if (!p.alive || !p.team) continue;
        const team = p.team;
        const enemyTeam = other(team);
        const own = flags[team];
        const enemy = flags[enemyTeam];
        if (!enemy.carrier && nearFlag(p, enemy.x, enemy.y, enemy.z)) {
          Object.assign(enemy, { carrier: p.id, carrierName: p.name, atHome: false });
          p.protUntil = 0;
          notice(room, `${p.name} cogió la bandera ${TEAMS[enemyTeam].name}`);
          event('take', enemyTeam, p.name);
        }
        if (!own.carrier && !own.atHome && nearFlag(p, own.x, own.y, own.z)) {
          flags[team] = homeFlag(own.home);
          notice(room, `${p.name} devolvió la bandera ${TEAMS[team].name}`);
          event('return', team, p.name);
        }
        const home = flags[team];
        if (enemy.carrier === p.id && home.atHome && nearFlag(p, ...home.home)) {
          flags[enemyTeam] = homeFlag(enemy.home);
          p.caps++;
          notice(room, `¡${p.name} capturó la bandera ${TEAMS[enemyTeam].name}!`);
          event('capture', enemyTeam, p.name);
          scoreTeam(room, team);
          if (room.matchOver) return;
        }
      }
    },
    onMatchReset() {
      flags = newFlags();
    },
    snapshot: () => ({ fl: { 1: flagSnapshot(flags[1]), 2: flagSnapshot(flags[2]) } }),
  };
}
