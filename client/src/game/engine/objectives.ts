// Mode objects drawn in the world: Capture the flag flags and bases, Kill confirmed tags, Domination zones and
// Bomb sites, the bomb, and Freeze tag statues (ice blocks).
import * as THREE from 'three';
import {
  BOMB,
  DOM,
  FLAG,
  FREEZE,
  SITE_NAMES,
  ZONE_NAMES,
  bombSites,
  dominationZones,
  type BombSnapshot,
  type DomSnapshot,
  type FlagSnapshot,
  type GameMap,
  type IceSnapshot,
  type ModeId,
  type SideTeam,
  type Team,
  type TagSnapshot,
} from '@blockshot/shared';
import { teamColor } from '../../settings/palette';
import { damp } from './util';

const SIDES: SideTeam[] = [1, 2];
/** A flag further than this from its target jumps there instead of gliding. */
const FLAG_SNAP_DISTANCE = 4;
const FLAG_FOLLOW = 12;
const FLAG_CARRIED_LIFT = 0.4;
const CLOTH_WAVE_SPEED = 0.004;
const CLOTH_WAVE = 0.3;
const TAG_LIFT = 0.6;
const TAG_SPIN = 0.004;
const TAG_BOB_SPEED = 0.005;
const TAG_BOB = 0.12;
const tagGeo = new THREE.OctahedronGeometry(0.32, 0);
const INK = '#1b2a4a';
const NEUTRAL = '#ece3cf';
const ZONE_PAD_OPACITY = 0.28;
const ZONE_RING_WIDTH = 0.25;
const ICE = '#a8e4ff';
const ICE_OPACITY = 0.45;
const ICE_SIZE: [number, number, number] = [1.1, 2, 1.1];
const THAW_RING_WIDTH = 0.18;
const BOMB_BLINK_SPEED = 0.012;
const BOMB_CARRIED_LIFT = 1.1;
const iceGeo = new THREE.BoxGeometry(...ICE_SIZE);
const bombGeo = new THREE.BoxGeometry(0.45, 0.28, 0.32);

/** Zones drawn on the floor for the mode: Domination zones or Bomb sites (null: none). */
function zonesOf(mode: ModeId, map: GameMap) {
  if (mode === 'dom') return { centres: dominationZones(map), radius: DOM.radius, names: ZONE_NAMES };
  if (mode === 'bomb') return { centres: bombSites(map), radius: BOMB.siteRadius, names: SITE_NAMES };
  return null;
}

// Flag icon that is visible through walls
function flagMarker(color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fillRect(22, 16, 4, 32);
  g.beginPath();
  g.moveTo(26, 16);
  g.lineTo(44, 23);
  g.lineTo(26, 31);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }),
  );
  s.scale.set(0.045, 0.045, 1);
  s.position.y = 3;
  s.renderOrder = 6;
  return s;
}

/** Domination zone letter, visible through walls, in the owner's colour (neutral: sand). */
function zoneMarker(): { sprite: THREE.Sprite; paint: (letter: string, color: string, contested: boolean) => void } {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }),
  );
  sprite.scale.set(0.05, 0.05, 1);
  sprite.position.y = 3.2;
  sprite.renderOrder = 6;
  const paint = (letter: string, color: string, contested: boolean) => {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = color;
    g.strokeStyle = contested ? '#ffffff' : INK;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.font = "32px 'Black Ops One', sans-serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, 32, 35);
    tex.needsUpdate = true;
  };
  return { sprite, paint };
}

interface ZoneObject {
  pad: THREE.Mesh;
  ring: THREE.Mesh;
  marker: ReturnType<typeof zoneMarker>;
  /** what is painted now: owner + contested (repainted only when it changes) */
  state: string;
}

interface FlagObject {
  t: SideTeam;
  group: THREE.Group;
  cloth: THREE.Mesh;
  pad: THREE.Mesh;
}

interface IceObject {
  block: THREE.Mesh;
  ring: THREE.Mesh;
  /** thaw progress drawn now (the ring is rebuilt only when it changes) */
  pct: number;
}

interface TagObject {
  mesh: THREE.Mesh;
  y: number;
  team: SideTeam;
}

export interface ObjectiveSources {
  myId: string;
  /** where a remote carrier is drawn (null if it is not visible) */
  carrierPose(id: string): { position: THREE.Vector3; rotationY: number } | null;
}

export class Objectives {
  flags: Record<SideTeam, FlagSnapshot> | null = null;
  private flagObjs: FlagObject[] | null = null;
  readonly tags = new Map<number, TagObject>();
  zones: DomSnapshot[] | null = null;
  private zoneObjs: ZoneObject[] | null = null;
  bomb: BombSnapshot | null = null;
  private bombObj: THREE.Mesh | null = null;
  private readonly ice = new Map<string, IceObject>();
  private iceList: readonly IceSnapshot[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly map: GameMap,
    private readonly mode: ModeId,
  ) {
    this.buildFlags();
  }

  /** Domination zones and Bomb sites: a disc and a ring on the floor each, and the letter above (rebuilt with the palette). */
  private buildZones(): void {
    for (const o of this.zoneObjs ?? []) this.scene.remove(o.pad, o.ring, o.marker.sprite);
    this.zoneObjs = null;
    const zones = zonesOf(this.mode, this.map);
    if (!zones) return;
    const { radius } = zones;
    this.zoneObjs = zones.centres.map(([x, y, z]) => {
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 40),
        new THREE.MeshBasicMaterial({
          color: NEUTRAL,
          transparent: true,
          opacity: ZONE_PAD_OPACITY,
          depthWrite: false,
        }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, y + 0.03, z);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - ZONE_RING_WIDTH, radius, 48),
        new THREE.MeshBasicMaterial({ color: NEUTRAL }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.04, z);
      const marker = zoneMarker();
      marker.sprite.position.set(x, y + 3.2, z);
      this.scene.add(pad, ring, marker.sprite);
      return { pad, ring, marker, state: '' };
    });
  }

  /** Capture the flag: flags and bases in each team's colour (rebuilt when the palette changes). */
  buildFlags(): void {
    this.buildZones();
    for (const o of this.flagObjs ?? []) this.scene.remove(o.group, o.pad);
    this.flagObjs = null;
    if (this.mode !== 'ctf') return;
    this.flagObjs = SIDES.map((t) => {
      const color = teamColor(t, '#ffffff');
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 2.4, 0.08),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }),
      );
      pole.position.y = 1.2;
      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.65, 0.05),
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
      );
      cloth.geometry.translate(0.52, 0, 0);
      cloth.position.y = 2;
      group.add(pole, cloth, flagMarker(color));
      const [x, y, z] = this.map.bases[t];
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(FLAG.radius, FLAG.radius, 0.08, 28),
        new THREE.MeshLambertMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.6,
        }),
      );
      pad.position.set(x, y + 0.04, z);
      group.position.set(x, y, z);
      this.scene.add(group, pad);
      return { t, group, cloth, pad };
    });
  }

  /** Kill confirmed: adds new tags, removes picked or expired ones. */
  syncTags(list: readonly TagSnapshot[] | null): void {
    const seen = new Set<number>();
    for (const [id, x, y, z, team] of list ?? []) {
      seen.add(id);
      if (this.tags.has(id)) continue;
      const color = teamColor(team, '#ffffff');
      const mesh = new THREE.Mesh(
        tagGeo,
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }),
      );
      mesh.position.set(x, y + TAG_LIFT, z);
      this.scene.add(mesh);
      this.tags.set(id, { mesh, y: y + TAG_LIFT, team });
    }
    for (const [id, t] of this.tags) {
      if (seen.has(id)) continue;
      this.scene.remove(t.mesh);
      (t.mesh.material as THREE.Material).dispose();
      this.tags.delete(id);
    }
  }

  /** Freeze tag: an ice block round each frozen player and a ring on the floor that fills as he is thawed. */
  syncIce(list: readonly IceSnapshot[] | null): void {
    this.iceList = list ?? [];
    const seen = new Set<string>();
    for (const [id, x, y, z, , pct] of this.iceList) {
      seen.add(id);
      let o = this.ice.get(id);
      if (!o) {
        const block = new THREE.Mesh(
          iceGeo,
          new THREE.MeshLambertMaterial({
            color: ICE,
            emissive: ICE,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: ICE_OPACITY,
            depthWrite: false,
          }),
        );
        const ring = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: ICE }));
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(block, ring);
        o = { block, ring, pct: 0 };
        this.ice.set(id, o);
      }
      o.block.position.set(x, y + ICE_SIZE[1] / 2, z);
      o.ring.position.set(x, y + 0.05, z);
      if (pct !== o.pct) {
        o.pct = pct;
        o.ring.geometry.dispose();
        o.ring.geometry = pct
          ? new THREE.RingGeometry(FREEZE.radius - THAW_RING_WIDTH, FREEZE.radius, 40, 1, 0, (pct / 100) * Math.PI * 2)
          : new THREE.BufferGeometry();
      }
    }
    for (const [id, o] of this.ice) {
      if (seen.has(id)) continue;
      this.scene.remove(o.block, o.ring);
      (o.block.material as THREE.Material).dispose();
      (o.ring.material as THREE.Material).dispose();
      o.ring.geometry.dispose();
      this.ice.delete(id);
    }
  }

  /** Owner and "contested" of a zone; a Bomb site turns red with the bomb planted, and pulses while planting or defusing. */
  private zoneState(i: number): [Team, number] {
    if (this.mode !== 'bomb') {
      const [owner, , contested] = this.zones?.[i] ?? [0, 0, 0];
      return [owner, contested];
    }
    const b = this.bomb;
    if (!b || b.s !== i) return [0, 0];
    return b.st === 2 ? [1, b.dp ? 1 : 0] : [0, b.pp ? 1 : 0];
  }

  /** Bomb: a small box over its carrier's shoulder, on the floor, or planted (blinking). Yours is not drawn. */
  private updateBomb(now: number, src: ObjectiveSources): void {
    const b = this.bomb;
    if (!b || b.c === src.myId) {
      if (this.bombObj) this.bombObj.visible = false;
      return;
    }
    if (!this.bombObj) {
      this.bombObj = new THREE.Mesh(
        bombGeo,
        new THREE.MeshLambertMaterial({ color: '#2b2b2b', emissive: '#ff2a1a', emissiveIntensity: 0 }),
      );
      this.scene.add(this.bombObj);
    }
    const o = this.bombObj;
    o.visible = true;
    const carrier = b.c ? src.carrierPose(b.c) : null;
    if (carrier) {
      o.position.copy(carrier.position);
      o.position.y += BOMB_CARRIED_LIFT;
    } else o.position.set(b.x, b.y + 0.14, b.z);
    (o.material as THREE.MeshLambertMaterial).emissiveIntensity =
      b.st === 2 && Math.sin(now * BOMB_BLINK_SPEED) > 0 ? 1 : 0;
  }

  update(dt: number, now: number, src: ObjectiveSources): void {
    const names = zonesOf(this.mode, this.map)?.names ?? ZONE_NAMES;
    this.zoneObjs?.forEach((o, i) => {
      const [owner, contested] = this.zoneState(i);
      const state = `${owner}${contested}`;
      if (state === o.state) return;
      o.state = state;
      const color = owner ? teamColor(owner, NEUTRAL) : NEUTRAL;
      (o.pad.material as THREE.MeshBasicMaterial).color.set(color);
      (o.ring.material as THREE.MeshBasicMaterial).color.set(color);
      o.marker.paint(names[i]!, color, !!contested);
    });
    this.updateBomb(now, src);
    for (const t of this.tags.values()) {
      t.mesh.rotation.y = now * TAG_SPIN;
      t.mesh.position.y = t.y + Math.sin(now * TAG_BOB_SPEED + t.mesh.id) * TAG_BOB;
    }
    if (!this.flagObjs || !this.flags) return;
    for (const o of this.flagObjs) {
      const f = this.flags[o.t];
      const g = o.group;
      // The one you carry is not drawn (it would be in your face); the HUD tells you instead
      g.visible = f.c !== src.myId;
      const carrier = f.c ? src.carrierPose(f.c) : null;
      if (carrier) {
        g.position.copy(carrier.position);
        g.position.y += FLAG_CARRIED_LIFT;
        g.rotation.y = carrier.rotationY;
      } else {
        const to = new THREE.Vector3(f.x, f.y, f.z);
        if (g.position.distanceTo(to) > FLAG_SNAP_DISTANCE) g.position.copy(to);
        else g.position.lerp(to, damp(FLAG_FOLLOW, dt));
      }
      o.cloth.rotation.y = Math.sin(now * CLOTH_WAVE_SPEED + o.t) * CLOTH_WAVE;
    }
  }

  /** Minimap data: tags and flags (a carried flag follows its carrier). */
  minimap(
    myPos: THREE.Vector3,
    src: ObjectiveSources,
  ): {
    tags: { x: number; z: number; team: SideTeam }[];
    flags: { x: number; z: number; team: SideTeam }[];
    zones: { x: number; z: number; owner: number; letter: string }[];
    bomb: { x: number; z: number } | null;
  } {
    const tags = [...this.tags.values()].map((t) => ({ x: t.mesh.position.x, z: t.mesh.position.z, team: t.team }));
    // Frozen players show like tags, in their team's colour
    for (const [, x, , z, team] of this.iceList) tags.push({ x, z, team });
    const flags: { x: number; z: number; team: SideTeam }[] = [];
    if (this.flags) {
      for (const t of SIDES) {
        const f = this.flags[t];
        const p = f.c === src.myId ? myPos : ((f.c ? src.carrierPose(f.c)?.position : null) ?? f);
        flags.push({ x: p.x, z: p.z, team: t });
      }
    }
    const def = zonesOf(this.mode, this.map);
    const zones = (def?.centres ?? []).map(([x, , z], i) => ({
      x,
      z,
      owner: this.zoneState(i)[0],
      letter: def!.names[i]!,
    }));
    const b = this.bomb;
    const bomb = !b ? null : b.c === src.myId ? myPos : ((b.c ? src.carrierPose(b.c)?.position : null) ?? b);
    return { tags, flags, zones, bomb: bomb ? { x: bomb.x, z: bomb.z } : null };
  }

  dispose(): void {
    for (const o of this.flagObjs ?? []) this.scene.remove(o.group, o.pad);
    for (const o of this.zoneObjs ?? []) this.scene.remove(o.pad, o.ring, o.marker.sprite);
    if (this.bombObj) this.scene.remove(this.bombObj);
    this.syncTags(null);
    this.syncIce(null);
  }
}
