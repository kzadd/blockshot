// The shrinking zone on the server: picks the centre, hurts whoever is outside and says when it closes.
// Round modes set it up at the start of each round and drop it between rounds; Por equipos runs it in cycles.
import {
  SERVER_TICK_MS,
  ZONE_WARN_MS,
  fullZoneRadius,
  round2,
  zoneAt,
  zoneCycleMs,
  zoneGround,
  type Spawn,
  type Vec3,
  type ZonePlan,
  type ZoneSnapshot,
} from '@blockshot/shared';
import { dieAlone } from '../combat/damage';
import type { Player } from '../players/player';
import { notice, type Room } from '../rooms/room';

/** Respawning inside a closed zone: at least this far inside the edge. */
const SPAWN_MARGIN = 3;
const DT = SERVER_TICK_MS / 1000;

/** `active`: false between rounds (the zone is gone until the next round sets it up again). */
export function shrinkingZone(room: Room, plan: ZonePlan, active: () => boolean = () => true) {
  let zone: { x: number; y: number; z: number; full: number; at: number } | null = null;
  let last = 0;
  /** players told they are outside (told again after they come back in) */
  const warned = new Set<string>();

  const state = (now: number) => (zone && active() ? zoneAt(plan, now - zone.at, zone.full) : null);
  const crossed = (now: number, ms: number) => !!zone && last - zone.at < ms && now - zone.at >= ms;

  function start(now: number): void {
    const spots = zoneGround(room.map);
    const [x, y, z] = spots[Math.floor(Math.random() * spots.length)]!;
    zone = { x, y, z, full: fullZoneRadius(room.map, x, z), at: now };
    last = now;
    warned.clear();
  }

  const outside = (p: Player, r: number) => !!zone && Math.hypot(p.x - zone.x, p.z - zone.z) > r;

  return {
    start,
    stop(): void {
      zone = null;
    },
    tick(now: number): void {
      if (plan.closedMs !== undefined && (!zone || now - zone.at >= zoneCycleMs(plan))) {
        if (zone) notice(room, 'La zona se abre: todo el mapa vuelve a ser seguro');
        start(now);
      }
      const s = state(now);
      if (!zone || !s) return;
      if (crossed(now, plan.openMs - ZONE_WARN_MS))
        notice(room, `La zona se cierra en ${ZONE_WARN_MS / 1000} s: vayan hacia el centro`);
      if (crossed(now, plan.openMs)) notice(room, '¡La zona se está cerrando! Fuera de ella pierdes vida');
      last = now;
      if (s.open) return;
      for (const p of room.players.values()) {
        if (!active()) break; // that death ended the round
        if (!p.alive || !outside(p, s.r)) {
          warned.delete(p.id);
          continue;
        }
        if (!warned.has(p.id)) {
          warned.add(p.id);
          room.channel.to(p.id, 'notice', ['¡Estás fuera de la zona! Vuelve dentro o morirás']);
        }
        p.lastDamage = now; // no regeneration outside
        p.hp -= s.dps * DT;
        if (p.hp <= 0) dieAlone(room, p, 'Zona');
        else room.channel.to(p.id, 'damaged', [{ hp: Math.ceil(p.hp), from: [round2(zone.x), round2(zone.z)] }]);
      }
    },
    /** While it is not open: only spawns well inside it (open ground near the centre if no map spawn is). */
    spawns(spawns: Spawn[]): Spawn[] {
      const s = state(last); // as of the last tick
      if (!zone || !s || s.open) return spawns;
      const { x, z } = zone;
      const inside = (p: Spawn | Vec3) => Math.hypot(p[0] - x, p[2] - z) <= s.r - SPAWN_MARGIN;
      const ok = spawns.filter(inside);
      if (ok.length) return ok;
      const ground = zoneGround(room.map).filter(inside);
      // Facing the centre (forward is (-sin yaw, -cos yaw))
      const spots: Vec3[] = ground.length ? ground : [[x, zone.y, z]];
      return spots.map(([sx, sy, sz]): Spawn => [sx, sy, sz, Math.atan2(sx - x, sz - z)]);
    },
    snapshot(now: number): ZoneSnapshot | null {
      const s = state(now);
      return zone && s ? [round2(zone.x), round2(zone.y), round2(zone.z), round2(s.r)] : null;
    },
  };
}
