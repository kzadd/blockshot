// Mode objects drawn in the world: Capture the flag flags and bases, Kill confirmed tags, Domination zones and
// Bomb sites, the bomb, Freeze tag statues (ice blocks) and the shrinking zone's wall.
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
  type ZoneSnapshot,
  type TagSnapshot,
} from '@blockshot/shared';
import { teamColor } from '../../settings/palette';
import { bombSeen } from '../objectiveView';
import { prop } from '../render/props';
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
/** Through-wall markers: over a statue's top, over the bomb carrier's head, over a bomb on the floor. */
const ICE_MARKER_Y = 2.7;
const BOMB_MARKER_CARRIED = 2.6;
const BOMB_MARKER_FLOOR = 1.4;
const BOMB_RED = '#ff3b30';
const iceGeo = new THREE.BoxGeometry(...ICE_SIZE);
/** The C4 charge (props.ts model): its height (m), and its red light that blinks once planted. */
const BOMB_SIZE = 0.36;
/** How far behind a carrier's middle the charge rides (m). */
const BOMB_ON_BACK = 0.24;
const UP = new THREE.Vector3(0, 1, 0);
const bombLightGeo = new THREE.SphereGeometry(0.035, 8, 6);

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

/** A round icon sprite drawn on a canvas, visible through walls (same size on screen at any distance). */
function iconSprite(): { sprite: THREE.Sprite; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }),
  );
  sprite.scale.set(0.045, 0.045, 1);
  sprite.renderOrder = 6;
  return { sprite, g, tex };
}

/** Frozen teammate: a snowflake on ice blue, the thaw progress as a white arc round it. */
function paintIce(g: CanvasRenderingContext2D, pct: number): void {
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = ICE;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 32, 22, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // the «snow» icon's three strokes (24-unit box scaled into the disc)
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.beginPath();
  for (const [x1, y1, x2, y2] of [
    [12, 4, 12, 20],
    [5, 8, 19, 16],
    [5, 16, 19, 8],
  ] as const) {
    g.moveTo(14 + x1 * 1.5, 14 + y1 * 1.5);
    g.lineTo(14 + x2 * 1.5, 14 + y2 * 1.5);
  }
  g.stroke();
  if (pct > 0) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(32, 32, 28, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2);
    g.stroke();
  }
}

/** The bomb: a black bomb with its fuse on a red disc. */
function paintBomb(g: CanvasRenderingContext2D): void {
  g.fillStyle = BOMB_RED;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(29, 36, 12, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(37, 27);
  g.lineTo(44, 19);
  g.stroke();
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
  /** through-wall snowflake with the thaw progress: shown to the statue's own team only */
  marker: ReturnType<typeof iconSprite>;
  team: SideTeam;
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
  myTeam: Team;
  /** a player's team (undefined: not in the room) */
  teamOf(id: string): Team | undefined;
  /** where a remote carrier is drawn (null if it is not visible) */
  carrierPose(id: string): { position: THREE.Vector3; rotationY: number } | null;
}

/** The shrinking zone: a see-through wall of light, tall enough to see from anywhere. */
const RING_HEIGHT = 80;
const RING_BELOW = 10;
const RING_SEGMENTS = 96;
const RING_COLOR = '#ff5a1f';
const RING_OPACITY = 0.28;
/** The drawn radius follows the server's this fast (it moves a little every snapshot). */
const RING_FOLLOW = 8;

export class Objectives {
  /** shrinking zone from the server (null: none) */
  ring: ZoneSnapshot | null = null;
  private ringWall: THREE.Mesh | null = null;
  flags: Record<SideTeam, FlagSnapshot> | null = null;
  private flagObjs: FlagObject[] | null = null;
  readonly tags = new Map<number, TagObject>();
  zones: DomSnapshot[] | null = null;
  private zoneObjs: ZoneObject[] | null = null;
  bomb: BombSnapshot | null = null;
  private bombObj: THREE.Group | null = null;
  private bombLight: THREE.Mesh | null = null;
  private bombMark: THREE.Sprite | null = null;
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
    for (const [id, x, y, z, team, pct] of this.iceList) {
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
        const marker = iconSprite();
        paintIce(marker.g, 0);
        marker.sprite.visible = false;
        this.scene.add(block, ring, marker.sprite);
        o = { block, ring, marker, team, pct: 0 };
        this.ice.set(id, o);
      }
      o.block.position.set(x, y + ICE_SIZE[1] / 2, z);
      o.ring.position.set(x, y + 0.05, z);
      o.marker.sprite.position.set(x, y + ICE_MARKER_Y, z);
      if (pct !== o.pct) {
        o.pct = pct;
        paintIce(o.marker.g, pct);
        o.marker.tex.needsUpdate = true;
        o.ring.geometry.dispose();
        o.ring.geometry = pct
          ? new THREE.RingGeometry(FREEZE.radius - THAW_RING_WIDTH, FREEZE.radius, 40, 1, 0, (pct / 100) * Math.PI * 2)
          : new THREE.BufferGeometry();
      }
    }
    for (const [id, o] of this.ice) {
      if (seen.has(id)) continue;
      this.scene.remove(o.block, o.ring, o.marker.sprite);
      o.marker.tex.dispose();
      o.marker.sprite.material.dispose();
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

  /** Bomb: a small box over its carrier's shoulder, on the floor, or planted (blinking). Yours is not drawn.
   * The teams that should know where it is (bombSeen) also get a bomb icon through walls. */
  private updateBomb(now: number, src: ObjectiveSources): void {
    const b = this.bomb;
    if (!this.bombMark && b) {
      const m = iconSprite();
      paintBomb(m.g);
      this.bombMark = m.sprite;
      this.scene.add(this.bombMark);
    }
    if (!b || b.c === src.myId) {
      if (this.bombObj) this.bombObj.visible = false;
      if (this.bombMark) this.bombMark.visible = false;
      return;
    }
    if (!this.bombObj) {
      this.bombLight = new THREE.Mesh(bombLightGeo, new THREE.MeshBasicMaterial({ color: '#ff2a1a' }));
      this.bombLight.position.set(0, BOMB_SIZE + 0.02, 0);
      this.bombObj = new THREE.Group().add(prop('bomb', BOMB_SIZE), this.bombLight);
      this.scene.add(this.bombObj);
    }
    const o = this.bombObj;
    o.visible = true;
    const carrier = b.c ? src.carrierPose(b.c) : null;
    if (carrier) {
      // Strapped to the carrier's back (bodies face -Z), not inside the torso
      o.position.set(0, BOMB_CARRIED_LIFT - BOMB_SIZE / 2, BOMB_ON_BACK);
      o.position.applyAxisAngle(UP, carrier.rotationY).add(carrier.position);
      o.rotation.y = carrier.rotationY;
    } else {
      o.position.set(b.x, b.y, b.z);
      o.rotation.y = 0;
    }
    this.bombLight!.visible = b.st === 2 && Math.sin(now * BOMB_BLINK_SPEED) > 0;
    const mark = this.bombMark!;
    mark.visible = bombSeen(b, src.myTeam, b.c ? src.teamOf(b.c) : undefined);
    mark.position.copy(o.position);
    mark.position.y += carrier ? BOMB_MARKER_CARRIED - BOMB_CARRIED_LIFT : BOMB_MARKER_FLOOR;
  }

  private updateRing(dt: number): void {
    const z = this.ring;
    if (!z) {
      if (this.ringWall) this.ringWall.visible = false;
      return;
    }
    let w = this.ringWall;
    if (!w) {
      w = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, RING_HEIGHT, RING_SEGMENTS, 1, true),
        new THREE.MeshBasicMaterial({
          color: RING_COLOR,
          transparent: true,
          opacity: RING_OPACITY,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
        }),
      );
      w.renderOrder = 2;
      this.ringWall = w;
      this.scene.add(w);
    }
    const [x, y, cz, r] = z;
    // A new centre (next round or cycle): jump there instead of sliding across the map
    const jump = !w.visible || Math.hypot(w.position.x - x, w.position.z - cz) > 0.5;
    w.visible = true;
    w.position.set(x, y + RING_HEIGHT / 2 - RING_BELOW, cz);
    const shown = jump ? r : w.scale.x + (r - w.scale.x) * damp(RING_FOLLOW, dt);
    w.scale.set(shown, 1, shown);
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
    this.updateRing(dt);
    // Frozen teammates only: rivals' statues get no through-wall icon
    for (const o of this.ice.values()) o.marker.sprite.visible = o.team === src.myTeam;
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
    ring: { x: number; z: number; r: number } | null;
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
    const seen = !!b && (b.c === src.myId || bombSeen(b, src.myTeam, b.c ? src.teamOf(b.c) : undefined));
    const bomb = !b || !seen ? null : b.c === src.myId ? myPos : ((b.c ? src.carrierPose(b.c)?.position : null) ?? b);
    const ring = this.ring ? { x: this.ring[0], z: this.ring[2], r: this.ring[3] } : null;
    return { tags, flags, zones, bomb: bomb ? { x: bomb.x, z: bomb.z } : null, ring };
  }

  dispose(): void {
    for (const o of this.flagObjs ?? []) this.scene.remove(o.group, o.pad);
    for (const o of this.zoneObjs ?? []) this.scene.remove(o.pad, o.ring, o.marker.sprite);
    if (this.bombObj) this.scene.remove(this.bombObj);
    if (this.bombMark) this.scene.remove(this.bombMark);
    if (this.ringWall) {
      this.scene.remove(this.ringWall);
      this.ringWall.geometry.dispose();
      (this.ringWall.material as THREE.Material).dispose();
    }
    this.syncTags(null);
    this.syncIce(null);
  }
}
