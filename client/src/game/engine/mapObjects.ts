// The map's objects (shared maps/objects.ts) as the player sees them: explosive barrels (Kenney's barrel painted
// red), wooden crates that break (Kenney's crate), health and armour floating over a glowing ring, ladders and
// zipline cables. The server says which barrels, crates and pickups are gone; those hide, and fallen barrels and
// crates leave the client's colliders too, so movement prediction matches the server.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  HAZARD,
  LADDER_DIRS,
  hammerAngle,
  pusherAt,
  sweeperAngle,
  type GameMap,
  type MapBox,
  type ObjectsDown,
  type ObjectsSnapshot,
  type PickupKind,
  type WeaponId,
} from '@blockshot/shared';
import { loadGun } from '../render/gunAssets';
import { preloadProps, prop } from '../render/props';

const BARREL_RED = 0xc23a2b;
const PICKUP_COLOR: Record<PickupKind, number> = { hp: 0x46d37f, armor: 0x4c9dff };
const PICKUP_SIZE: Record<PickupKind, number> = { hp: 0.42, armor: 0.5 };
const PICKUP_FLOAT = 0.55;
const PICKUP_BOB = 0.08;
const PICKUP_SPIN = 1.6;
const RING_R = 0.6;
const POWER_COLOR = 0xff7a1a;
/** Race course: obstacle and tile colours (bright, like a game show). */
const HAZARD_MAT = new THREE.MeshLambertMaterial({ color: 0xff3d7f });
const HAZARD_DARK = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
const TILE_MATS = [0xffd23a, 0x4c9dff, 0x46d37f, 0xb58cff].map((color) => new THREE.MeshLambertMaterial({ color }));
/** Radius of an air strike warning ring (the blast's). */
const STRIKE_R = 2.5;
/** Height of the light beam over a power weapon (seen from across the map). */
const BEAM_H = 14;
const CABLE_R = 0.025;
const RAIL = 0.06;
const RUNG_STEP = 0.32;

preloadProps('barrel', 'crate', 'medkit', 'shield');

const metal = new THREE.MeshLambertMaterial({ color: 0x5d636b });
const cableMat = new THREE.MeshLambertMaterial({ color: 0x23262b });

/** A copy of `g` with its materials tinted (the barrel's red paint), once the model has loaded. */
function tinted(g: THREE.Group, color: number): THREE.Group {
  const paint = (o: THREE.Object3D) =>
    o.traverse((m) => {
      if (!(m instanceof THREE.Mesh) || m.userData.tinted) return;
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      (m.material as THREE.MeshStandardMaterial).color.setHex(color);
      m.userData.tinted = true;
    });
  // The model arrives later: paint it when it is added
  g.addEventListener('childadded', (e) => paint((e as unknown as { child: THREE.Object3D }).child));
  paint(g);
  return g;
}

interface Pickup {
  kind: PickupKind;
  group: THREE.Group;
  item: THREE.Group;
  y: number;
}

export class MapObjects {
  private readonly root = new THREE.Group();
  private readonly barrels: THREE.Group[];
  private readonly crates: THREE.Group[];
  private readonly pickups: Pickup[];
  private down: { barrels: Set<number>; crates: Set<number>; pickups: Set<number>; tiles: Set<number> } = {
    barrels: new Set(),
    crates: new Set(),
    pickups: new Set(),
    tiles: new Set(),
  };
  private shaking = new Set<number>();
  private readonly tiles: THREE.Mesh[];
  /** moving obstacles: the part that moves (turned or placed every frame from the server time) */
  private readonly hazards: { h: GameMap['hazards'][number]; part: THREE.Object3D }[];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly map: GameMap,
  ) {
    const place = (g: THREE.Group, b: MapBox) => {
      g.position.set(b.x, b.y, b.z);
      this.root.add(g);
      return g;
    };
    this.barrels = map.barrels.map((b) => place(tinted(prop('barrel', [b.w, b.h, b.d]), BARREL_RED), b));
    this.crates = map.crates.map((b) => place(prop('crate', [b.w, b.h, b.d]), b));
    this.pickups = map.pickups.map((p) => {
      const group = new THREE.Group();
      group.position.set(p.x, p.y, p.z);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(RING_R * 0.78, RING_R, 32),
        new THREE.MeshBasicMaterial({ color: PICKUP_COLOR[p.k], transparent: true, opacity: 0.75 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      const item =
        p.k === 'hp' ? prop('medkit', PICKUP_SIZE.hp) : tinted(prop('shield', PICKUP_SIZE.armor), PICKUP_COLOR.armor);
      item.position.y = PICKUP_FLOAT;
      group.add(ring, item);
      this.root.add(group);
      return { kind: p.k, group, item, y: PICKUP_FLOAT };
    });
    // Race checkpoints: a glowing frame on the floor (green), the finish in orange
    map.checkpoints.forEach((c, i) => {
      const last = i === map.checkpoints.length - 1;
      const mat = new THREE.MeshBasicMaterial({
        color: last ? POWER_COLOR : PICKUP_COLOR.hp,
        transparent: true,
        opacity: 0.8,
      });
      const t = 0.25;
      for (const [w, d, ox, oz] of [
        [c.w, t, 0, -c.d / 2 + t / 2],
        [c.w, t, 0, c.d / 2 - t / 2],
        [t, c.d, -c.w / 2 + t / 2, 0],
        [t, c.d, c.w / 2 - t / 2, 0],
      ] as const) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat);
        m.position.set(c.x + ox, c.y + 0.03, c.z + oz);
        this.root.add(m);
      }
    });
    // Dropping tiles: bright squares (they shake before they go)
    this.tiles = map.tiles.map((b, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), TILE_MATS[i % TILE_MATS.length]!);
      m.position.set(b.x, b.y + b.h / 2, b.z);
      m.castShadow = m.receiveShadow = true;
      this.root.add(m);
      return m;
    });
    // Moving obstacles
    this.hazards = map.hazards.map((h) => {
      const base = new THREE.Group();
      base.position.set(h.x, h.y, h.z);
      let part: THREE.Object3D;
      if (h.k === 'sweeper') {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 16), HAZARD_DARK);
        hub.position.y = 0.6;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * h.len, 2 * HAZARD.sweepR, 2 * HAZARD.sweepR), HAZARD_MAT);
        bar.position.y = HAZARD.sweepH;
        part = new THREE.Group().add(bar);
        base.add(hub, part);
      } else if (h.k === 'hammer') {
        const pivot = new THREE.Group();
        pivot.position.y = h.len;
        const rope = new THREE.Mesh(new THREE.BoxGeometry(0.15, h.len, 0.15), HAZARD_DARK);
        rope.position.y = -h.len / 2;
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2 * HAZARD.head, 2 * HAZARD.head), HAZARD_MAT);
        head.position.y = -h.len;
        pivot.add(rope, head);
        part = pivot;
        base.add(pivot);
      } else {
        part = new THREE.Mesh(new THREE.BoxGeometry(HAZARD.pushW, HAZARD.pushH, HAZARD.pushD), HAZARD_MAT);
        this.root.add(part);
      }
      part.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      this.root.add(base);
      return { h, part };
    });
    const ladders = this.ladderMesh();
    if (ladders) this.root.add(ladders);
    for (const [a, b] of map.ziplines) this.root.add(this.cable(new THREE.Vector3(...a), new THREE.Vector3(...b)));
    scene.add(this.root);
  }

  /** Every ladder of the map as one mesh: two rails and rungs, standing just off its wall. */
  private ladderMesh(): THREE.Mesh | null {
    const parts: THREE.BufferGeometry[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
      parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    for (const l of this.map.ladders) {
      const [dx, dz] = LADDER_DIRS[l.dir]!;
      const h = l.y1 - l.y0 + 0.6;
      const cx = l.x - dx * 0.08;
      const cz = l.z - dz * 0.08;
      // Along the wall: x when the climber faces ±z, z when facing ±x
      for (const s of [-1, 1]) {
        const ox = dz ? s * 0.36 : 0;
        const oz = dx ? s * 0.36 : 0;
        box(RAIL, h, RAIL, cx + ox, l.y0 + h / 2, cz + oz);
      }
      for (let y = l.y0 + 0.3; y < l.y1 + 0.3; y += RUNG_STEP) box(dz ? 0.72 : 0.04, 0.04, dx ? 0.72 : 0.04, cx, y, cz);
    }
    if (!parts.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(parts), metal);
    mesh.castShadow = true;
    return mesh;
  }

  /** A zipline: the cable and an anchor block at each end. */
  private cable(a: THREE.Vector3, b: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    const len = a.distanceTo(b);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(CABLE_R, CABLE_R, len, 6), cableMat);
    wire.position.copy(a).add(b).multiplyScalar(0.5);
    wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(wire);
    for (const p of [a, b]) {
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), metal);
      anchor.position.copy(p);
      g.add(anchor);
    }
    return g;
  }

  /** Applies the server's list of what is gone. True when barrels or crates changed (colliders to rebuild). */
  sync(wo: ObjectsSnapshot | undefined): boolean {
    const [b, c, p, td = [], ts = []] = wo ?? [[], [], []];
    const same = (set: Set<number>, list: number[]) => set.size === list.length && list.every((i) => set.has(i));
    const solidChanged = !same(this.down.barrels, b) || !same(this.down.crates, c) || !same(this.down.tiles, td);
    this.down = { barrels: new Set(b), crates: new Set(c), pickups: new Set(p), tiles: new Set(td) };
    this.shaking = new Set(ts);
    this.tiles.forEach((m, i) => (m.visible = !this.down.tiles.has(i)));
    this.barrels.forEach((g, i) => (g.visible = !this.down.barrels.has(i)));
    this.crates.forEach((g, i) => (g.visible = !this.down.crates.has(i)));
    this.pickups.forEach((k, i) => (k.group.visible = !this.down.pickups.has(i)));
    return solidChanged;
  }

  objectsDown(): ObjectsDown {
    return this.down;
  }

  /** Pickups on the floor now, for the minimap. */
  /** The power weapon lying on the map: a beam of light over an orange ring, the gun spinning in it. */
  private power: { key: string; group: THREE.Group; gun: THREE.Object3D | null } | null = null;
  syncPower(pw: [number, WeaponId] | null | undefined): void {
    const key = pw ? `${pw[0]}:${pw[1]}` : '';
    if ((this.power?.key ?? '') === key) return;
    if (this.power) this.root.remove(this.power.group);
    this.power = null;
    const at = pw && this.map.powerSpots[pw[0]];
    if (!pw || !at) return;
    const group = new THREE.Group();
    group.position.set(at[0], at[1], at[2]);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RING_R, RING_R * 1.35, 40),
      new THREE.MeshBasicMaterial({ color: POWER_COLOR, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, BEAM_H, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: POWER_COLOR,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.y = BEAM_H / 2;
    group.add(ring, beam);
    this.root.add(group);
    const entry: { key: string; group: THREE.Group; gun: THREE.Object3D | null } = { key, group, gun: null };
    this.power = entry;
    void loadGun(pw[1]).then((g) => {
      if (this.power !== entry) return;
      g.scale.setScalar(1.6);
      g.position.y = 1.1;
      group.add(g);
      entry.gun = g;
    });
  }

  /** Air strike warnings: pulsing red rings on the ground where the blasts will land, until they do. */
  private readonly marks: { mesh: THREE.Mesh; until: number }[] = [];
  strikeMarks(at: readonly [number, number, number][], ms: number, now: number): void {
    for (const [x, y, z] of at) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(STRIKE_R * 0.8, STRIKE_R, 40),
        new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.8, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + 0.05, z);
      this.root.add(mesh);
      this.marks.push({ mesh, until: now + ms });
    }
  }

  /** Where the power weapon lies now, for the minimap. */
  powerAt(): { x: number; z: number } | null {
    return this.power ? { x: this.power.group.position.x, z: this.power.group.position.z } : null;
  }

  available(): { k: PickupKind; x: number; z: number }[] {
    return this.map.pickups.filter((_, i) => !this.down.pickups.has(i)).map((p) => ({ k: p.k, x: p.x, z: p.z }));
  }

  /** `serverNow`: the server's clock, which the moving obstacles run on. */
  update(now: number, serverNow = now): void {
    const t = now / 1000;
    for (const { h, part } of this.hazards) {
      if (h.k === 'sweeper') part.rotation.y = -sweeperAngle(h, serverNow);
      else if (h.k === 'hammer') part.rotation.x = hammerAngle(h, serverNow);
      else part.position.set(...pusherAt(h, serverNow));
    }
    this.shaking.forEach((i) => {
      const m = this.tiles[i];
      const b = this.map.tiles[i];
      if (m && b) m.position.set(b.x + Math.sin(now * 0.09) * 0.05, b.y + b.h / 2, b.z + Math.cos(now * 0.11) * 0.05);
    });
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i]!;
      if (now < m.until) {
        (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * Math.abs(Math.sin(t * 8));
        continue;
      }
      this.root.remove(m.mesh);
      this.marks.splice(i, 1);
    }
    if (this.power?.gun) {
      this.power.gun.rotation.y = t * PICKUP_SPIN;
      this.power.gun.position.y = 1.1 + Math.sin(t * 2) * PICKUP_BOB;
    }
    for (const k of this.pickups) {
      if (!k.group.visible) continue;
      k.item.rotation.y = t * PICKUP_SPIN;
      k.item.position.y = k.y + Math.sin(t * 2.2) * PICKUP_BOB;
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
  }
}
