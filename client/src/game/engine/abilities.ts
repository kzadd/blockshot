// Ability objects in the world, from the snapshot: smoke clouds (a heap of grey blocks that grows, drifts and
// fades), mines (a dark puck with a blinking light) and cover walls (which rise from the floor and also go into
// the client's colliders, so its movement prediction bumps into them like the server does).
import * as THREE from 'three';
import { SMOKE, WALL, type Collider, type DeployableSnapshot } from '@blockshot/shared';

/** Blocks per cloud and how long it takes to grow / to fade out (ms). */
const SMOKE_PUFFS = 44;
const SMOKE_GROW_MS = 700;
const SMOKE_FADE_MS = 1400;
const SMOKE_OPACITY = 0.97;
const SMOKE_DRIFT = 0.12;
const WALL_RISE_MS = 220;
const MINE_BLINK_MS = 700;

interface Obj {
  kind: DeployableSnapshot[1];
  group: THREE.Group;
  born: number;
  collider: Collider | null;
  /** smoke: its blocks with their drift speed */
  puffs?: { mesh: THREE.Mesh; spin: number }[];
  light?: THREE.Mesh;
}

const box = new THREE.BoxGeometry(1, 1, 1);
const mineGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.12, 12);
const lightGeo = new THREE.SphereGeometry(0.06, 8, 6);
const mineMat = new THREE.MeshLambertMaterial({ color: '#2b2f36' });
const lightOn = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
const lightOff = new THREE.MeshBasicMaterial({ color: '#4a1414' });
const wallMat = new THREE.MeshLambertMaterial({ color: '#9aa1a8' });
const wallEdge = new THREE.MeshLambertMaterial({ color: '#6f767d' });

export class AbilityObjects {
  private readonly objs = new Map<number, Obj>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Adds new objects and removes gone ones. True when the set of walls changed (colliders to rebuild). */
  sync(list: readonly DeployableSnapshot[], now: number): boolean {
    let wallsChanged = false;
    const seen = new Set<number>();
    for (const d of list) {
      seen.add(d[0]);
      if (this.objs.has(d[0])) continue;
      const o = this.make(d, now);
      this.objs.set(d[0], o);
      this.scene.add(o.group);
      if (o.collider) wallsChanged = true;
    }
    for (const [id, o] of this.objs) {
      if (seen.has(id)) continue;
      this.scene.remove(o.group);
      for (const p of o.puffs ?? []) (p.mesh.material as THREE.Material).dispose();
      if (o.collider) wallsChanged = true;
      this.objs.delete(id);
    }
    return wallsChanged;
  }

  /** 0..1: how deep `p` is inside a smoke cloud (the HUD greys the screen out). */
  smokeAt(p: THREE.Vector3, now: number): number {
    let k = 0;
    for (const o of this.objs.values()) {
      if (o.kind !== 'smoke') continue;
      const c = o.group.position;
      const d =
        Math.hypot(p.x - c.x, (p.y - c.y - SMOKE.radius * 0.35) * 1.4, p.z - c.z) / (SMOKE.radius * o.group.scale.x);
      const fade = Math.max(0, Math.min(1, (SMOKE.durationMs - (now - o.born)) / SMOKE_FADE_MS));
      k = Math.max(k, Math.min(1, (1.05 - d) * 2.5) * fade);
    }
    return k;
  }

  walls(): Collider[] {
    return [...this.objs.values()].flatMap((o) => (o.collider ? [o.collider] : []));
  }

  private make([, kind, x, y, z, along]: DeployableSnapshot, now: number): Obj {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    if (kind === 'smoke') {
      // Random blocks inside the cloud's sphere, bigger towards the middle
      const puffs = Array.from({ length: SMOKE_PUFFS }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * SMOKE.radius * 0.8;
        const s = 2.2 + Math.random() * 2 * (1 - r / SMOKE.radius);
        const shade = 0.78 + Math.random() * 0.14;
        const mesh = new THREE.Mesh(
          box,
          new THREE.MeshLambertMaterial({
            color: new THREE.Color(shade, shade, shade * 1.02),
            transparent: true,
            opacity: SMOKE_OPACITY,
            depthWrite: false,
            side: THREE.DoubleSide, // seen from inside too: no clear view out of the cloud
          }),
        );
        mesh.position.set(Math.cos(a) * r, 0.4 + Math.random() * SMOKE.radius * 0.6 + (i % 3) * 0.3, Math.sin(a) * r);
        mesh.scale.setScalar(s);
        mesh.rotation.set(Math.random(), Math.random() * 3, Math.random());
        group.add(mesh);
        return { mesh, spin: (Math.random() - 0.5) * SMOKE_DRIFT };
      });
      group.scale.setScalar(0.2);
      return { kind, group, born: now, collider: null, puffs };
    }
    if (kind === 'mine') {
      const puck = new THREE.Mesh(mineGeo, mineMat);
      puck.position.y = 0.06;
      const light = new THREE.Mesh(lightGeo, lightOn);
      light.position.y = 0.14;
      group.add(puck, light);
      return { kind, group, born: now, collider: null, light };
    }
    // Cover wall: a concrete slab with a darker cap, rising from the floor
    const [w, d] = along === 0 ? [WALL.w, WALL.t] : [WALL.t, WALL.w];
    const slab = new THREE.Mesh(box, wallMat);
    slab.scale.set(w, WALL.h, d);
    slab.position.y = WALL.h / 2;
    slab.castShadow = slab.receiveShadow = true;
    const cap = new THREE.Mesh(box, wallEdge);
    cap.scale.set(w + 0.06, 0.1, d + 0.06);
    cap.position.y = WALL.h;
    group.add(slab, cap);
    group.scale.y = 0.05;
    return {
      kind,
      group,
      born: now,
      collider: { c: 'concrete', min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + WALL.h, z + d / 2] },
    };
  }

  update(dt: number, now: number): void {
    for (const o of this.objs.values()) {
      const age = now - o.born;
      if (o.kind === 'smoke') {
        o.group.scale.setScalar(0.2 + 0.8 * Math.min(1, age / SMOKE_GROW_MS));
        const left = SMOKE.durationMs - age;
        const alpha = SMOKE_OPACITY * Math.max(0, Math.min(1, left / SMOKE_FADE_MS));
        for (const p of o.puffs ?? []) {
          p.mesh.rotation.y += p.spin * dt;
          (p.mesh.material as THREE.MeshLambertMaterial).opacity = alpha;
        }
      } else if (o.kind === 'mine' && o.light) {
        o.light.material = Math.floor(age / MINE_BLINK_MS) % 2 ? lightOff : lightOn;
      } else if (o.kind === 'wall') {
        o.group.scale.y = Math.min(1, 0.05 + age / WALL_RISE_MS);
      }
    }
  }

  dispose(): void {
    for (const o of this.objs.values()) {
      this.scene.remove(o.group);
      for (const p of o.puffs ?? []) (p.mesh.material as THREE.Material).dispose();
    }
    this.objs.clear();
  }
}
