// Other players: their models, name tags and an interpolation buffer. They are drawn VIEW_DELAY_MS in the
// past, between two received snapshots, so they move smoothly whatever the network jitter (the server
// rewinds by the same delay when checking shots).
import * as THREE from 'three';
import {
  CHAR_BY_ID,
  VIEW_DELAY_MS,
  isOutfitColor,
  isTeamMode,
  loadoutOf,
  type CharacterId,
  type HitTarget,
  type ModeId,
  type PlayerSnapshot,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import { palette, teamColor } from '../../settings/palette';
import {
  buildCharacter,
  buildGun,
  makeNameTag,
  type CharacterModel,
  type GunModel,
  type NameTag,
} from '../render/models';
import { damp, dampAngle } from './util';

const INFECTED_COLOR = '#6fcf3a';
/** Snapshots kept per player: 4.5 s at 20 Hz, enough to replay how you died. */
const BUFFER_SIZE = 90;
const NAME_TAG_Y = 2.3;
const REMOTE_GUN_SCALE = 1.3;
/** Muzzle flash of remote guns (ms) and the shot origin when the gun is not drawn yet. */
const REMOTE_FLASH_MS = 60;
const MUZZLE_Y_STANDING = 1.35;
const MUZZLE_Y_SLIDING = 0.85;
const BUBBLE_Y = 0.95;
// Spawn protection bubble
const bubbleGeo = new THREE.SphereGeometry(1, 18, 12);
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
const BUBBLE_OPACITY = 0.14;
const BUBBLE_PULSE = 0.08;
const BUBBLE_PULSE_SPEED = 0.008;
// Animation
const AIM_FOLLOW = 14;
const WALK_CYCLE = 2.2;
const WALK_FULL_SPEED = 7;
const LEG_SWING = 0.7;
const LEG_SWING_CROUCHED = 0.35;
/** Knee bend per radian of the leg swinging back while walking. */
const KNEE_BEND = 1.3;
/** Crouched: front shin vertical, back knee on the floor. */
const KNEE_CROUCH_FRONT = -1.1;
const KNEE_CROUCH_BACK = -1.25;
/** A running enemy (not crouched, not in the air) this close leaves a footstep mark. */
const FOOTSTEP_SPEED = 3;
const FOOTSTEP_EVERY_M = 4.5;
const FOOTSTEP_RANGE = 20;
const AIRBORNE_DY = 0.3;

export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  sl: number;
  cr: number;
}

export interface Outfit {
  color: string;
  skin: string;
}

export interface Remote {
  id: string;
  name: string;
  model: CharacterModel | null;
  tag: NameTag | null;
  bubble: THREE.Mesh | null;
  charId: CharacterId | null;
  skin: SkinId | null;
  /** outfit colour picked by the player */
  co: string;
  team: Team | -1;
  color: string;
  weaponId: WeaponId | null;
  gun: GunModel | null;
  buffer: Sample[];
  rx: number;
  sl: number;
  cr: number;
  alive: boolean;
  wasAlive: boolean;
  prot: boolean;
  walk: number;
  stepAcc: number;
  /** performance.now() of its last shot (minimap) */
  lastShot: number;
}

/** In team modes everybody wears its team colour; in free for all, the colour the player picked and its skin. */
export function outfitFor(mode: ModeId, charId: CharacterId, skin: string, team: Team, color?: string): Outfit {
  const ch = CHAR_BY_ID[charId];
  // Team modes paint the uniform in the team colour; the skin (who you are) is always yours
  if (mode === 'infect' && team === 2) return { color: INFECTED_COLOR, skin: 'zombi' };
  if (isTeamMode(mode) && team) return { color: teamColor(team, ch.color), skin };
  return { color: isOutfitColor(color) ? color : ch.color, skin };
}

export class RemotePlayers {
  readonly all = new Map<string, Remote>();
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly mode: ModeId,
    private readonly limit: number,
    private readonly isMate: (team: Team) => boolean,
    private readonly myTeam: () => Team,
  ) {}

  /** Forces every model to be rebuilt (team change, colourblind palette). */
  invalidate(): void {
    for (const r of this.all.values()) r.team = -1;
  }

  onSnapshot(players: readonly PlayerSnapshot[], myId: string, now: number): void {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === myId) continue;
      seen.add(p.id);
      let r = this.all.get(p.id);
      if (!r) {
        r = {
          id: p.id,
          name: p.n,
          model: null,
          tag: null,
          bubble: null,
          charId: null,
          skin: null,
          co: '',
          team: -1,
          color: '#ffffff',
          weaponId: null,
          gun: null,
          buffer: [],
          rx: 0,
          sl: 0,
          cr: 0,
          alive: false,
          wasAlive: false,
          prot: false,
          walk: 0,
          stepAcc: 0,
          lastShot: 0,
        };
        this.all.set(p.id, r);
      }
      if (p.c && (r.charId !== p.c || r.skin !== p.sk || r.co !== p.co || r.team !== p.tm)) this.build(r, p);
      r.name = p.n;
      r.rx = p.rx;
      r.sl = p.sl;
      r.cr = p.cr;
      r.alive = !!p.a;
      r.prot = !!p.pr;
      if (!r.model || !r.charId) continue;
      // A player that just (re)spawned jumps to its new place instead of sliding there
      if (r.alive && !r.wasAlive) r.buffer.length = 0;
      r.buffer.push({ t: now, x: p.x, y: p.y, z: p.z, ry: p.ry, rx: p.rx, sl: p.sl, cr: p.cr });
      if (r.buffer.length > BUFFER_SIZE) r.buffer.shift();
      const ch = CHAR_BY_ID[r.charId];
      r.tag?.userData.setHp(Math.min(1, p.h / (p.mh || ch.hp)));
      const wid = loadoutOf(this.mode, ch, p.lv, this.limit, p.tm)[p.s] ?? ch.primary;
      if (wid !== r.weaponId) this.setGun(r, wid);
      if (r.alive && !r.wasAlive) {
        r.model.group.position.set(p.x, p.y, p.z);
        r.model.group.rotation.y = p.ry;
      }
      r.wasAlive = r.alive;
      r.model.group.visible = r.alive;
    }
    for (const id of [...this.all.keys()]) if (!seen.has(id)) this.remove(id);
  }

  private build(r: Remote, p: PlayerSnapshot): void {
    if (!p.c) return;
    if (r.model) this.scene.remove(r.model.group);
    const { color, skin } = outfitFor(this.mode, p.c, p.sk, p.tm, p.co);
    r.model = buildCharacter(p.c, skin, color);
    r.color = color;
    // Team modes: name in the team colour (teammates are seen through walls); otherwise the enemy colour
    const teams = isTeamMode(this.mode);
    const mate = teams && p.tm === this.myTeam();
    const tag = makeNameTag(p.n, teams ? teamColor(p.tm, palette().enemy) : palette().enemy, mate);
    tag.position.y = NAME_TAG_Y;
    r.model.group.add(tag);
    r.tag = tag;
    r.bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    r.bubble.scale.set(0.7, 1.1, 0.7);
    r.bubble.position.y = BUBBLE_Y;
    r.bubble.visible = false;
    r.model.group.add(r.bubble);
    r.model.group.position.set(p.x, p.y, p.z);
    this.scene.add(r.model.group);
    r.charId = p.c;
    r.skin = p.sk;
    r.co = p.co;
    r.team = p.tm;
    r.weaponId = null;
    r.gun = null;
    r.buffer.length = 0;
  }

  private setGun(r: Remote, wid: WeaponId): void {
    if (!r.model) return;
    const g = buildGun(wid, true, r.color);
    g.scale.setScalar(REMOTE_GUN_SCALE);
    r.model.holdGun(g);
    r.weaponId = wid;
    r.gun = g;
  }

  private remove(id: string): void {
    const r = this.all.get(id);
    if (r?.model) this.scene.remove(r.model.group);
    this.all.delete(id);
  }

  /** Interpolated pose at `renderTime` (ms, performance.now based). */
  private sample(r: Remote, renderTime: number): Sample | null {
    const b = r.buffer;
    const last = b[b.length - 1];
    if (!last) return null;
    if (renderTime >= last.t || b.length === 1) return last;
    for (let i = b.length - 1; i > 0; i--) {
      const a = b[i - 1]!;
      const c = b[i]!;
      if (a.t <= renderTime) {
        const k = (renderTime - a.t) / Math.max(1, c.t - a.t);
        return {
          t: renderTime,
          x: a.x + (c.x - a.x) * k,
          y: a.y + (c.y - a.y) * k,
          z: a.z + (c.z - a.z) * k,
          ry: dampAngle(a.ry, c.ry, k),
          rx: a.rx + (c.rx - a.rx) * k,
          sl: c.sl,
          cr: c.cr,
        };
      }
    }
    return b[0]!;
  }

  /** Pose of a remote at `renderTime` (death replay camera). */
  poseAt(id: string, renderTime: number): Sample | null {
    const r = this.all.get(id);
    return r ? this.sample(r, renderTime) : null;
  }

  /**
   * Moves and animates every remote; `footstep` is called for nearby running enemies. `rewind` (ms) draws
   * everybody that much further in the past (death replay); `hidden` is not drawn (the replay camera is in it).
   */
  update(
    dt: number,
    now: number,
    me: THREE.Vector3 | null,
    footstep: (x: number, z: number) => void,
    rewind = 0,
    hidden: string | null = null,
  ): void {
    const k = damp(AIM_FOLLOW, dt);
    bubbleMat.opacity = BUBBLE_OPACITY + BUBBLE_PULSE * Math.sin(now * BUBBLE_PULSE_SPEED);
    const renderTime = now - VIEW_DELAY_MS - rewind;
    for (const r of this.all.values()) {
      if (r.model) r.model.group.visible = r.alive && r.id !== hidden;
      if (!r.model || !r.alive) continue;
      if (r.bubble) r.bubble.visible = r.prot;
      const flash = r.gun?.userData.flash;
      if (flash) flash.visible = now - r.lastShot < REMOTE_FLASH_MS;
      const g = r.model.group;
      const s = this.sample(r, renderTime);
      if (!s) continue;
      const bx = g.position.x;
      const bz = g.position.z;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.ry;
      r.model.aim.rotation.x += (s.rx - r.model.aim.rotation.x) * k;
      const speed = Math.hypot(g.position.x - bx, g.position.z - bz) / Math.max(dt, 1e-4);
      r.walk += speed * dt * WALK_CYCLE;
      const latest = r.buffer[r.buffer.length - 1]!;
      // Footsteps: a nearby enemy running (not crouched, not in the air) leaves a white mark
      if (
        me &&
        !this.isMate(r.team === -1 ? 0 : r.team) &&
        !r.cr &&
        speed > FOOTSTEP_SPEED &&
        Math.abs(g.position.y - latest.y) < AIRBORNE_DY
      ) {
        r.stepAcc += speed * dt;
        if (r.stepAcc > FOOTSTEP_EVERY_M && g.position.distanceTo(me) < FOOTSTEP_RANGE) {
          r.stepAcc = 0;
          footstep(g.position.x, g.position.z);
        }
      }
      // Walking swings the legs; sliding stretches them; crouching puts a knee down
      const { sl, cr } = s;
      const swing = sl
        ? 0
        : Math.sin(r.walk) * Math.min(speed / WALK_FULL_SPEED, 1) * (cr ? LEG_SWING_CROUCHED : LEG_SWING);
      const low = sl || cr;
      r.model.legL.rotation.x = sl ? 1.2 : cr ? 1.1 + swing : swing;
      r.model.legR.rotation.x = sl ? 1.2 : cr ? -0.35 - swing : -swing;
      const kneeL = sl ? 0 : cr ? KNEE_CROUCH_FRONT : -Math.max(0, -swing) * KNEE_BEND;
      const kneeR = sl ? 0 : cr ? KNEE_CROUCH_BACK : -Math.max(0, swing) * KNEE_BEND;
      r.model.kneeL.rotation.x += (kneeL - r.model.kneeL.rotation.x) * k;
      r.model.kneeR.rotation.x += (kneeR - r.model.kneeR.rotation.x) * k;
      r.model.legL.position.y = r.model.legR.position.y += ((low ? 0.5 : 0.8) - r.model.legR.position.y) * k;
      r.model.upper.position.y += ((low ? -0.5 : 0) - r.model.upper.position.y) * k;
    }
  }

  /** Where every visible enemy is drawn right now (what the player aims at). */
  targets(): HitTarget[] {
    const out: HitTarget[] = [];
    for (const r of this.all.values()) {
      const g = r.model?.group.position;
      if (r.alive && g && !this.isMate(r.team === -1 ? 0 : r.team)) {
        out.push({ id: r.id, x: g.x, y: g.y, z: g.z, sl: r.sl, cr: r.cr, alive: true });
      }
    }
    return out;
  }

  /** World position of a remote's model, if it is drawn. */
  position(id: string | null): THREE.Vector3 | null {
    if (!id) return null;
    return this.all.get(id)?.model?.group.position ?? null;
  }

  markShot(id: string, now: number): Remote | undefined {
    const r = this.all.get(id);
    if (!r) return r;
    r.lastShot = now;
    const flash = r.gun?.userData.flash;
    if (flash) {
      flash.rotation.z = Math.random() * Math.PI * 2;
      flash.visible = true;
    }
    return r;
  }

  /** Shot origin of a remote: the muzzle of the gun it holds (or its gun height while not drawn). */
  muzzle(r: Remote, out = this.tmp): THREE.Vector3 | null {
    if (r.gun && r.model) {
      r.model.group.updateMatrixWorld(true);
      return r.gun.localToWorld(out.set(0, r.gun.userData.muzzleY, r.gun.userData.muzzleZ));
    }
    const g = r.model?.group.position;
    return g ? out.set(g.x, g.y + (r.sl ? MUZZLE_Y_SLIDING : MUZZLE_Y_STANDING), g.z) : null;
  }

  dispose(): void {
    for (const id of [...this.all.keys()]) this.remove(id);
  }
}
