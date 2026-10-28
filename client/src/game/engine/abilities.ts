// Ability objects in the world, from the snapshot: smoke clouds (Kenney's smoke puffs round the canister that
// throws them; they grow, drift and fade), mines (Quaternius's landmine with a blinking light) and cover walls
// (two rows of Quaternius's sandbags that rise from the floor). Walls also go into the client's colliders, so its
// movement prediction bumps into them like the server does; the collider is the same box as before.
import * as THREE from 'three';
import { SMOKE, WALL, type Collider, type DeployableSnapshot } from '@blockshot/shared';
import { FX, fxFrame } from '../render/fxAtlas';
import { preloadProps, prop } from '../render/props';

/** Puffs per cloud and how long it takes to grow / to fade out (ms). */
const SMOKE_PUFFS = 34;
const SMOKE_SHADE = 0xd6d8dc;
const CANISTER_SIZE = 0.3;
const MINE_SIZE = 0.62;
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
  /** smoke: its puffs with their spin */
  puffs?: { sprite: THREE.Sprite; spin: number }[];
  light?: THREE.Mesh;
}

const lightGeo = new THREE.SphereGeometry(0.045, 8, 6);
const lightOn = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
const lightOff = new THREE.MeshBasicMaterial({ color: '#4a1414' });
preloadProps('smokegren', 'mine', 'sacks');

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
      for (const p of o.puffs ?? []) p.sprite.material.dispose();
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
      // Puffs inside the cloud's sphere, bigger towards the middle, round the canister on the floor
      const puffs = Array.from({ length: SMOKE_PUFFS }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * SMOKE.radius * 0.8;
        const mat = new THREE.SpriteMaterial({
          map: fxFrame(FX.puff[i % FX.puff.length]!),
          color: SMOKE_SHADE,
          transparent: true,
          opacity: SMOKE_OPACITY,
          depthWrite: false,
          rotation: Math.random() * Math.PI * 2,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(Math.cos(a) * r, 0.5 + Math.random() * SMOKE.radius * 0.7, Math.sin(a) * r);
        sprite.scale.setScalar(3.2 + Math.random() * 2.4 * (1 - r / SMOKE.radius));
        group.add(sprite);
        return { sprite, spin: (Math.random() - 0.5) * SMOKE_DRIFT };
      });
      const canister = prop('smokegren', CANISTER_SIZE);
      canister.rotation.z = Math.PI / 2; // lying on its side
      canister.position.y = 0.05;
      group.add(canister);
      return { kind, group, born: now, collider: null, puffs };
    }
    if (kind === 'mine') {
      const light = new THREE.Mesh(lightGeo, lightOn);
      light.position.y = 0.17;
      group.add(prop('mine', MINE_SIZE), light);
      return { kind, group, born: now, collider: null, light };
    }
    // Cover wall: two rows of sandbags filling the collider's box, rising from the floor
    const [w, d] = along === 0 ? [WALL.w, WALL.t] : [WALL.t, WALL.w];
    for (let row = 0; row < 2; row++) {
      const bags = prop('sacks', [WALL.w, WALL.h / 2, WALL.t]);
      bags.position.y = (row * WALL.h) / 2;
      if (along !== 0) bags.rotation.y = Math.PI / 2;
      // the top row is shifted half a bag, like real stacked sandbags
      bags.position[along === 0 ? 'x' : 'z'] = row ? 0.12 : 0;
      group.add(bags);
    }
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
          p.sprite.material.rotation += p.spin * dt;
          p.sprite.material.opacity = alpha;
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
      for (const p of o.puffs ?? []) p.sprite.material.dispose();
    }
    this.objs.clear();
  }
}
