// The map's objects (shared maps/objects.ts) as the player sees them: explosive barrels (Kenney's barrel painted
// red), wooden crates that break (Kenney's crate), health and armour floating over a glowing ring, ladders and
// zipline cables. The server says which barrels, crates and pickups are gone; those hide, and fallen barrels and
// crates leave the client's colliders too, so movement prediction matches the server.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  LADDER_DIRS,
  type GameMap,
  type MapBox,
  type ObjectsDown,
  type ObjectsSnapshot,
  type PickupKind,
} from '@blockshot/shared';
import { preloadProps, prop } from '../render/props';

const BARREL_RED = 0xc23a2b;
const PICKUP_COLOR: Record<PickupKind, number> = { hp: 0x46d37f, armor: 0x4c9dff };
const PICKUP_SIZE: Record<PickupKind, number> = { hp: 0.42, armor: 0.5 };
const PICKUP_FLOAT = 0.55;
const PICKUP_BOB = 0.08;
const PICKUP_SPIN = 1.6;
const RING_R = 0.6;
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
  private down: { barrels: Set<number>; crates: Set<number>; pickups: Set<number> } = {
    barrels: new Set(),
    crates: new Set(),
    pickups: new Set(),
  };

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
    const [b, c, p] = wo ?? [[], [], []];
    const same = (set: Set<number>, list: number[]) => set.size === list.length && list.every((i) => set.has(i));
    const solidChanged = !same(this.down.barrels, b) || !same(this.down.crates, c);
    this.down = { barrels: new Set(b), crates: new Set(c), pickups: new Set(p) };
    this.barrels.forEach((g, i) => (g.visible = !this.down.barrels.has(i)));
    this.crates.forEach((g, i) => (g.visible = !this.down.crates.has(i)));
    this.pickups.forEach((k, i) => (k.group.visible = !this.down.pickups.has(i)));
    return solidChanged;
  }

  objectsDown(): ObjectsDown {
    return this.down;
  }

  /** Pickups on the floor now, for the minimap. */
  available(): { k: PickupKind; x: number; z: number }[] {
    return this.map.pickups.filter((_, i) => !this.down.pickups.has(i)).map((p) => ({ k: p.k, x: p.x, z: p.z }));
  }

  update(now: number): void {
    const t = now / 1000;
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
