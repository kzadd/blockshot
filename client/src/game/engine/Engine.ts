// The game client: owns the renderer and the loop (outside React) and wires input, prediction, remote
// players, weapons, effects and objectives. React only receives a HUD summary a few times per second.
import * as THREE from 'three';
import {
  type CamoId,
  type FinishId,
  CHAR_BY_ID,
  CLIENT_SEND_MS,
  FIXED_DT,
  HITBOX,
  INFECT,
  PLAYER,
  VIEW_DELAY_MS,
  WEAPONS,
  WEAPON_HANDLING,
  GRENADE,
  SHIELD,
  stepGrenade,
  throwVelocity,
  castShot,
  climbables,
  liveColliders,
  grenadesFor,
  gunLadder,
  isTeamMode,
  loadoutOf,
  type Character,
  type Collider,
  type GameMap,
  type GrenadeSnapshot,
  type InfectSnapshot,
  type KillEvent,
  type ModeId,
  type MoveContext,
  type MoveInput,
  type PlayerSnapshot,
  type RoundSnapshot,
  type SideTeam,
  type SkinId,
  type SpawnedMessage,
  type StateSnapshot,
  type Team,
  type Vec3,
} from '@blockshot/shared';
import type { GameSocket } from '../../network/socket';
import { getSettings, subscribe, type Settings } from '../../settings/settingsStore';
import { attachAudio } from '../audio/audioEvents';
import { sfx } from '../audio/sound';
import type { HudState, DamageMark, SoundMark } from '../hud/hudState';
import type { MinimapSource, MinimapView } from '../hud/Minimap';
import type { Look } from '../../characters/looks';
import { loadGun } from '../render/gunAssets';
import { buildCharacter, buildGun, type CharacterModel } from '../render/models';
import { preloadProps, prop } from '../render/props';
import { buildWorld } from '../render/world';
import { AbilityObjects } from './abilities';
import { MapObjects } from './mapObjects';
import { CameraRig } from './cameraRig';
import { createDevStats, type FrameStats } from './devStats';
import { Effects } from './effects';
import { EventBus } from './events';
import { InputController } from './input';
import { LocalPlayer } from './localPlayer';
import { NetClient } from './netClient';
import { Objectives } from './objectives';
import { RemotePlayers, WALK_PHASE_PER_M, animateLegs, outfitFor } from './remotePlayers';
import { wallNormal } from './surface';
import { damp, dampAngle, screenAngle } from './util';
import { ViewModel, type Gadget } from './viewModel';
import { WeaponController } from './weapons';

const HUD_MS = 1000 / 15;
const MAX_PIXEL_RATIO = 1.5;
/** Sun shadow map size per graphics quality. */
const HIGH_SHADOW_MAP = 2048;
const LOW_SHADOW_MAP = 1024;
/** Filmic tone mapping keeps bright sunlit walls from clipping; exposure compensates its darker mid-tones. */
const TONE_EXPOSURE = 1.15;
/** Frame-based animations never step more than this (s), like a 30 fps frame. */
const MAX_FRAME_DT = 1 / 30;
/** The simulation catches up at most this much real time after a stall (tab in background…). */
const MAX_SIM_CATCH_UP = 0.25;
const MS_PER_S = 1000;
/** After spawning the trigger is ignored this long (clicks made while dead). */
const SPAWN_FIRE_GRACE_MS = 300;
/** Automatic respawn requests are retried at most this often. */
const SPAWN_RETRY_MS = 1000;
/** After a match restarts the player respawns almost at once. */
const RESTART_RESPAWN_MS = 800;
/** Camera dip when dashing (a landing of this many m/s). */
const DASH_KICK = 6;
/** Aiming further than this (0..1) the gun steps aside and the HUD draws its sight, so the target stays visible. */
const ADS_SIGHT = 0.85;
/** Abilities whose object shows in the first-person left hand, and for how long (ms) when it has no duration. */
const GADGET_OF: Partial<Record<string, Gadget>> = { shield: 'shield', medkit: 'medkit', radar: 'radio' };
const GADGET_MS = 900;
/** How long the shield flashes after stopping a bullet (ms). */
const SHIELD_FLASH_MS = 220;
/** Speed lines: from walking speed up to this much faster (× walk) they grow to full; sprinting and sliding
 * always show at least this much. */
const SPEED_FX_RANGE = 1.2;
const SPRINT_FX = 0.45;
const SLIDE_FX = 0.85;
const DAMAGE_DIR_MS = 1200;
const DAMAGE_FLASH_MS = 600;
const SOUND_MARK_MS = 1000;
const HIT_FLASH_MS = 220;
const HIT_MARK_MS = 300;
/** Enemy gunshots closer than this leave a mark around the crosshair. */
const SHOT_MARK_RANGE = 45;
/** Body box used to tell a remote bullet that stopped on a player (blood) from one in the air. */
const BODY_HALF_WIDTH = HITBOX.halfWidth + 0.1;
const BODY_HEIGHT = HITBOX.headHeight + HITBOX.headRadius;
/** Gunshots fade out with distance and are silent from this far (m). */
const SHOT_SOUND_RANGE = 70;
const REMOTE_SHOT_VOLUME = 0.8;
const SHOT_MARK_COLOR = '#ffc93c';
const STEP_MARK_COLOR = '#f7f9fc';
/** Enemies on the minimap appear after shooting and fade out in this time (ms). */
const SHOW_SHOT_MS = 1500;
const DEFAULT_ADS_SENS = 0.9;
/** Death replay: the last REPLAY_MS before dying, seen from the killer, starting REPLAY_DELAY_MS after it. */
const REPLAY_MS = 2400;
const REPLAY_DELAY_MS = 350;
/** Own poses and remote shots are kept this long for the replay. */
const REPLAY_LOG_MS = 4000;
const REPLAY_SHOT_VOLUME = 0.6;
/** How long the killer's gun kicks back after each replayed shot. */
const REPLAY_KICK_MS = 110;
/** How fast the replay ghost's knees follow their pose (1/s). */
const GHOST_FOLLOW = 14;

interface SelfPose {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}
interface ShotLog {
  id: string;
  t: number;
  w: keyof typeof WEAPONS | null;
  ends: Vec3[];
}
interface Replay {
  killerId: string;
  /** performance.now() when it starts playing, and the moment it shows (REPLAY_MS before dying) */
  start: number;
  from: number;
  /** our own body, drawn where we were */
  ghost: CharacterModel | null;
  /** the ghost's walk cycle and where it was last frame */
  walk: number;
  last: SelfPose | null;
  /** the killer's last pose and replayed shot (their first-person gun moves and kicks with them) */
  killerPose: { x: number; z: number } | null;
  flashAt: number;
  /** replay time already played (shots in between are fired) */
  played: number;
}
/** The grenade model's size against the grenade's collision radius, and how fast it tumbles (rad/s). */
const GRENADE_MODEL = 2.6;
const GRENADE_TUMBLE = 9;
/** Grenade aim: points kept of the predicted flight (one every ARC_EVERY steps) and the landing ring size. */
const ARC_POINTS = 64;
const ARC_EVERY = 2;
const LANDING_R = 0.9;
/** How fast a drawn grenade catches up with the server position (1/s). */
const GRENADE_FOLLOW = 18;
/** Blasts are heard from this far (m) and shake the view closer than BOOM_SHAKE_RANGE. */
const BOOM_SOUND_RANGE = 80;
const BOOM_SHAKE_RANGE = 12;
const BOOM_SHAKE = 14;

interface SoundTick {
  key: number;
  x: number;
  z: number;
  color: string;
  t: number;
}

export type HudListener = (hud: HudState) => void;

export class Engine implements MinimapSource {
  /** character, skin and outfit colour to respawn with automatically (null while choosing) */
  autoChar: { id: string; look: Look } | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly vm: ViewModel;
  /** The killer's gun and hands in the death replay, seen from their eyes. */
  private readonly killVm: ViewModel;
  /** map boxes, the barrels and crates standing and the cover walls (rebuilt when any of them changes) */
  private readonly colliders: Collider[];
  private readonly mapObjs: MapObjects;
  private readonly abilityObjs: AbilityObjects;
  /** G is held: the arc and landing ring show, release throws */
  private grenadeAim = false;
  private readonly arc: THREE.Line;
  private readonly landing: THREE.Mesh;
  private readonly bus = new EventBus();
  private readonly input: InputController;
  private readonly local = new LocalPlayer();
  private readonly net: NetClient;
  private readonly remotes: RemotePlayers;
  private readonly objectives: Objectives;
  private readonly effects: Effects;
  private readonly weapons: WeaponController;
  private readonly offs: (() => void)[] = [];
  private readonly clock = new THREE.Clock();
  private raf = 0;
  private stats: FrameStats | null = null;
  private disposed = false;

  // Our player
  private character: Character | null = null;
  private skin: SkinId = 'base';
  private color = '';
  private camo: CamoId = 'liso';
  private finish: FinishId = 'estandar';
  private alive = false;
  private everSpawned = false;
  private hp = 0;
  private maxHp = 100;
  private armor = 0;
  private level = 0;
  private myTeam: Team = 0;
  private protUntil = 0;
  private life = 0;
  private readonly renderPos = new THREE.Vector3();
  private readonly tmpNormal = new THREE.Vector3();
  private simAcc = 0;
  private sendAcc = 0;
  private hudAcc = 0;
  private spawnReqAt = 0;

  // Death and HUD state
  private deathAt = 0;
  private deathPos: THREE.Vector3 | null = null;
  private killerId: string | null = null;
  private killerName = '';
  private hitTime = 0;
  private hitHead = false;
  private hitRed = false;
  private damageTime = 0;
  private damageDirs: { x: number; z: number; t: number }[] = [];
  private ticks: SoundTick[] = [];
  private players: PlayerSnapshot[] = [];
  private teamScore: Record<SideTeam, number> | null = null;
  private infect: InfectSnapshot | null = null;
  private radar = false;
  /** our shield: when it ends (predicted from when the snapshot showed it) and when it last stopped a bullet */
  private shieldUntil = 0;
  private shieldHitAt = 0;
  private adsSens = DEFAULT_ADS_SENS;
  private colorblind: Settings['colorblind'] | undefined;
  /** quick chat menu open (V): the number keys pick a phrase instead of a weapon */
  private grenades = 0;
  private round: RoundSnapshot | null = null;
  private selfLog: SelfPose[] = [];
  private shotLog: ShotLog[] = [];
  private replay: Replay | null = null;
  /** grenades in flight: the mesh glides to the last position the server sent */
  private readonly flying = new Map<number, { mesh: THREE.Object3D; target: THREE.Vector3 }>();
  /** when the last grenade left the hand (the first-person throw) */
  private thrownAt = -1e9;

  constructor(
    private readonly container: HTMLElement,
    socket: GameSocket,
    private readonly myId: string,
    private readonly onHud: HudListener,
    private readonly map: GameMap,
    private readonly mode: ModeId = 'ffa',
    private readonly limit = 0,
  ) {
    this.colliders = liveColliders(map);
    const aspect = container.clientWidth / container.clientHeight;

    // Calidad gráfica (read when entering a room): baja = no antialias, 1 pixel per CSS pixel, hard shadows
    // at half size — for integrated graphics; alta = antialias, up to MAX_PIXEL_RATIO, soft shadows
    const high = getSettings().quality === 'alta';
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: 'high-performance' }));
    r.setPixelRatio(high ? Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO) : 1);
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = TONE_EXPOSURE;
    r.autoClear = false;
    container.appendChild(r.domElement);

    buildWorld(this.scene, map, high ? HIGH_SHADOW_MAP : LOW_SHADOW_MAP);
    this.rig = new CameraRig(getSettings().fov, aspect, map.half * 10);
    this.vm = new ViewModel(aspect);
    this.vm.initEnvironment(r);
    preloadProps('grenade');
    this.killVm = new ViewModel(aspect);
    this.killVm.initEnvironment(r);
    // Blood splats land on the first wall (or floor) behind a hit
    this.effects = new Effects(this.scene, (from, dir, max) => {
      const { t, hit } = castShot([from.x, from.y, from.z], [dir.x, dir.y, dir.z], this.colliders, [], '', max);
      if (!hit) return null;
      const point = from.clone().addScaledVector(dir, t);
      const normal = wallNormal(point, this.colliders, new THREE.Vector3());
      return normal ? { point, normal } : null;
    });
    this.abilityObjs = new AbilityObjects(this.scene);
    this.mapObjs = new MapObjects(this.scene, map);
    // Grenade aim: a dotted arc and a ring where it will land (hidden until G is held)
    this.arc = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3),
      ),
      new THREE.LineDashedMaterial({
        color: 0xffd34d,
        dashSize: 0.25,
        gapSize: 0.15,
        depthTest: false,
        transparent: true,
      }),
    );
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 5;
    this.arc.visible = false;
    this.landing = new THREE.Mesh(
      new THREE.RingGeometry(LANDING_R - 0.12, LANDING_R, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.landing.visible = false;
    this.scene.add(this.arc, this.landing);
    this.objectives = new Objectives(this.scene, map, mode);
    this.remotes = new RemotePlayers(
      this.scene,
      mode,
      limit,
      (t) => this.isMate(t),
      () => this.myTeam,
    );
    this.net = new NetClient(socket);

    this.input = new InputController(r.domElement, {
      canAct: () => this.alive,
      switchSlot: (s) => this.weapons.switchSlot(s, performance.now()),
      switchPrevious: () => this.weapons.switchSlot(this.weapons.prevSlot, performance.now()),
      cycleSlot: (dir) => this.weapons.cycle(dir, performance.now()),
      reload: () => this.weapons.startReload(performance.now()),
      sensMultiplier: () => (this.alive ? this.weapons.sensMultiplier(this.adsSens) : 1),
      pulledDown: (rad) => this.weapons.pulledDown(rad),
      resize: () => this.resize(),
      intercept: (code) => this.intercept(code),
    });
    this.weapons = new WeaponController(
      this.input,
      this.bus,
      {
        camera: this.rig.camera,
        colliders: this.colliders,
        targets: () => this.remotes.targets(),
        rtt: () => this.net.rtt,
        // Inputs go first, so the server has simulated up to where we stood when the shot arrives
        send: (msg) => {
          this.flushInputs();
          this.net.shoot(msg);
        },
        fired: () => (this.protUntil = 0),
        sendReload: () => this.net.reload(),
        sendSwitch: (s) => this.net.switchSlot(s),
        bullet: (from, to, hit, pellet) =>
          this.effects.bullet(
            from,
            to,
            hit,
            hit === 'wall' ? wallNormal(to, this.colliders, this.tmpNormal) : null,
            pellet,
          ),
        muzzle: (out) => this.vm.muzzleWorld(this.rig.camera, out),
      },
      () => this.setGun(),
    );

    this.offs.push(attachAudio(this.bus));
    this.applySettings(getSettings());
    this.offs.push(subscribe((st) => this.applySettings(st)));
    this.bindNet();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    void createDevStats(container).then((s) => {
      if (this.disposed) s?.dispose();
      else this.stats = s;
    });
  }

  // ============================================================ Settings and looks
  private applySettings(st: Settings): void {
    this.input.sens = st.sens;
    this.adsSens = st.adsSens ?? DEFAULT_ADS_SENS;
    this.rig.baseFov = st.fov;
    sfx.setVolume(st.volume);
    // Colourblind mode: rivals, names and the gun are repainted
    if (this.colorblind !== undefined && this.colorblind !== st.colorblind) this.refreshColors();
    this.colorblind = st.colorblind;
  }

  private refreshColors(): void {
    this.remotes.invalidate();
    if (this.alive) this.setGun();
    this.objectives.buildFlags();
  }

  private isMate(team: Team): boolean {
    return isTeamMode(this.mode) && team === this.myTeam;
  }

  private setGun(): void {
    if (!this.character) return;
    const { color, skin, camo } = outfitFor(
      this.mode,
      this.character.id,
      this.skin,
      this.myTeam,
      this.color,
      this.camo,
    );
    this.vm.setGun(this.weapons.weaponId(), color, skin, camo, this.finish);
  }

  private equip(): void {
    if (!this.character) return;
    this.weapons.equip(loadoutOf(this.mode, this.character, this.level, this.limit, this.myTeam));
  }

  /** Movement rules for one command: the held weapon's weight and the mode's speed bonus. */
  private moveContext(input: Pick<MoveInput, 'slot'>): MoveContext {
    const id = this.weapons.loadout[input.slot] ?? this.weapons.weaponId();
    const w = WEAPONS[id];
    const infected = this.mode === 'infect' && this.myTeam === 2;
    const speed = this.character?.speed ?? 0;
    const spawn = this.map.spawns[0];
    return {
      colliders: this.colliders,
      walk: speed * w.weight * (infected ? INFECT.speed : 1),
      adsMove: w.adsMove,
      fallback: spawn ? [spawn[0], spawn[1], spawn[2]] : [0, 0, 0],
      dash: this.character?.ability === 'dash',
      ...climbables(this.map),
    };
  }

  // ============================================================ Network
  private bindNet(): void {
    const net = this.net;
    net.on('state', (s) => this.onState(s));
    net.on('player:spawned', (d) => this.onSpawned(d));
    net.on('player:ack', (ack) => {
      if (this.alive && ack.life === this.life) this.local.reconcile(ack, (i) => this.moveContext(i));
    });
    net.on('shot', (d) => this.onRemoteShot(d.id, d.w, d.e));
    net.on('shield:hit', (d) => {
      if (d.id === this.myId) {
        this.shieldHitAt = performance.now();
        sfx.blip(1800, 0.09, 'triangle', 0.25);
        sfx.blip(2600, 0.07, 'triangle', 0.15, 0.03);
      } else this.effects.bullet(new THREE.Vector3(...d.at), new THREE.Vector3(...d.at), 'wall', null);
    });
    net.on('damaged', (d) => {
      // Healed (medkit, health on the floor): no hurt effects
      const healed = d.hp >= this.hp;
      this.hp = d.hp;
      if (healed) return;
      this.damageTime = performance.now();
      this.damageDirs.push({ x: d.from[0], z: d.from[1], t: this.damageTime });
      this.bus.emit('hurt');
    });
    net.on('hitmarker', (d) => {
      this.hitTime = performance.now();
      this.hitHead = d.head;
      this.hitRed = d.head || d.kill;
      this.weapons.confirmHit(this.hitTime);
      this.bus.emit('hit', { head: d.head, kill: d.kill });
      this.effects.damageNumber(d.at, d.dmg, d.head, d.kill);
    });
    net.on('kill', (d) => {
      if (d.victim === this.myId) return this.die(d);
      // Someone else died: the body breaks into blocks where it stood
      const at = this.remotes.position(d.victim);
      if (at) this.effects.shatter(at.clone());
    });
    net.on('loadout', (d) => {
      // Gun game / infected: a new weapon (levelling up, a knife kill, or being infected)
      const up = d.level > this.level || (d.team !== undefined && d.team !== this.myTeam);
      this.level = d.level;
      if (d.team !== undefined) this.myTeam = d.team;
      if (this.alive) {
        this.equip();
        this.weapons.swapUntil = performance.now() + WEAPON_HANDLING.swapMs;
      }
      if (up) this.bus.emit('streak');
    });
    net.on('boom', (d) => this.onBoom(d.x, d.y, d.z));
    net.on('crate', (d) => {
      const at = new THREE.Vector3(d.x, d.y, d.z);
      this.effects.splinters(at);
      sfx.thud(140, 0.25, Math.max(0.1, 0.6 - at.distanceTo(this.rig.camera.position) / 60));
    });
    net.on('pickup', () => {
      sfx.blip(660, 0.07, 'triangle', 0.18);
      sfx.blip(990, 0.09, 'triangle', 0.16, 0.06);
    });
    net.on('tag', (d) => this.bus.emit('tag', { confirm: d.type === 'confirm' }));
    net.on('flag', (d) => this.bus.emit('flag', { type: d.type }));
    net.on('match:end', () => {
      this.endReplay();
      this.alive = false;
      this.deathPos = null;
      this.deathAt = 0;
      document.exitPointerLock?.();
    });
    net.on('match:start', () => {
      this.alive = false; // the admin restarted mid-life
      this.respawnSoon();
    });
  }

  /** Keys that are not movement or weapons: ability (E) and grenade (G). */
  private intercept(code: string): boolean {
    if (code === 'KeyE') {
      this.useAbility();
      return true;
    }
    if (code === 'KeyG') {
      // Hold to see where it lands, release to throw
      if (this.alive && this.grenades > 0) this.grenadeAim = true;
      return true;
    }
    return false;
  }

  /** While G is held: the arc the grenade will fly (same physics as the server) and where it ends up. */
  private updateGrenadeAim(): void {
    if (!this.grenadeAim) return;
    // Paused or dead while aiming: no throw
    if (!this.alive || !this.input.locked) {
      this.grenadeAim = false;
      this.arc.visible = this.landing.visible = false;
      return;
    }
    if (!this.input.keys.has('KeyG')) {
      this.grenadeAim = false;
      this.arc.visible = this.landing.visible = false;
      this.throwGrenade();
      return;
    }
    const cam = this.rig.camera;
    const d = cam.getWorldDirection(new THREE.Vector3());
    const pos: [number, number, number] = [cam.position.x, cam.position.y, cam.position.z];
    const st = this.local.state;
    const vel = throwVelocity([d.x, d.y, d.z], st.vx, st.vz);
    // Only the boxes it can reach in its flight
    const reach = GRENADE.speed * (GRENADE.fuseMs / MS_PER_S) + 2;
    const near = this.colliders.filter(
      (c) =>
        c.max[0] > pos[0] - reach &&
        c.min[0] < pos[0] + reach &&
        c.max[2] > pos[2] - reach &&
        c.min[2] < pos[2] + reach,
    );
    const attr = this.arc.geometry.getAttribute('position') as THREE.BufferAttribute;
    const steps = Math.round(GRENADE.fuseMs / MS_PER_S / FIXED_DT);
    let n = 0;
    for (let i = 0; i <= steps && n < ARC_POINTS; i++) {
      if (i % ARC_EVERY === 0) attr.setXYZ(n++, pos[0], pos[1], pos[2]);
      stepGrenade(pos, vel, near, FIXED_DT);
    }
    attr.needsUpdate = true;
    this.arc.geometry.setDrawRange(0, n);
    this.arc.computeLineDistances(); // the dashes follow the new shape
    this.arc.visible = true;
    this.landing.position.set(pos[0], pos[1] - GRENADE.size + 0.03, pos[2]);
    this.landing.visible = true;
  }

  private throwGrenade(): void {
    if (!this.alive || this.grenades <= 0) return;
    const cam = this.rig.camera;
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    this.flushInputs(); // the server must have us where we threw from
    this.net.grenade([cam.position.x, cam.position.y, cam.position.z], [d.x, d.y, d.z]);
    this.grenades--;
    this.thrownAt = performance.now();
    this.protUntil = 0;
    sfx.thud(600, 0.12, 0.35);
  }

  /** Grenades in flight from the snapshot: new ones get a mesh, gone ones are removed. */
  private syncGrenades(list: GrenadeSnapshot[]): void {
    const seen = new Set<number>();
    for (const [id, x, y, z] of list) {
      seen.add(id);
      const g = this.flying.get(id);
      if (g) g.target.set(x, y, z);
      else {
        // Quaternius's grenade, tumbling as it flies
        const mesh = prop('grenade', GRENADE.size * GRENADE_MODEL);
        mesh.position.set(x, y, z);
        mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        this.scene.add(mesh);
        this.flying.set(id, { mesh, target: new THREE.Vector3(x, y, z) });
      }
    }
    for (const [id, g] of this.flying) {
      if (seen.has(id)) continue;
      this.scene.remove(g.mesh);
      this.flying.delete(id);
    }
  }

  private onBoom(x: number, y: number, z: number): void {
    const at = new THREE.Vector3(x, y, z);
    this.effects.explosion(at);
    const dist = at.distanceTo(this.rig.camera.position);
    sfx.boom(Math.max(0.15, 1 - dist / BOOM_SOUND_RANGE));
    if (this.alive && dist < BOOM_SHAKE_RANGE) this.rig.land(-BOOM_SHAKE * (1 - dist / BOOM_SHAKE_RANGE));
  }

  private flushInputs(): void {
    this.net.inputs(this.local.takeUnsent());
    this.sendAcc = 0;
  }

  /** Spawn now (first time, or after picking a character once the countdown ended). */
  spawn(characterId: string, look: Look): void {
    this.autoChar = { id: characterId, look };
    const now = performance.now();
    if (this.alive || (this.deathAt && now - this.deathAt < PLAYER.respawnDelay)) return;
    this.spawnReqAt = now;
    this.net.spawn(characterId, look);
  }

  requestLock(): void {
    this.input.requestLock();
  }

  /** 0..1 strength of the speed lines: sprinting, sliding and chained hops. */
  private speedFx(st: { vx: number; vz: number; sprinting: boolean; sliding: boolean }): number {
    const walk = this.moveContext({ slot: this.weapons.slot }).walk;
    const hs = Math.hypot(st.vx, st.vz);
    const fast = Math.max(0, Math.min(1, (hs - walk) / (walk * SPEED_FX_RANGE)));
    const floor = st.sliding ? SLIDE_FX : st.sprinting && hs > walk ? SPRINT_FX : 0;
    return Math.max(fast, floor);
  }

  /** New match (or a new map after a vote): respawn almost at once with the same character. */
  respawnSoon(): void {
    this.killerName = '';
    this.deathAt = performance.now() - PLAYER.respawnDelay + RESTART_RESPAWN_MS;
  }

  /** Key E: the dash goes with the next movement command; the rest are asked to the server. */
  private useAbility(): void {
    if (!this.alive || !this.character) return;
    if (this.character.ability === 'dash') {
      if (this.local.state.dashCd <= 0) this.input.pressDash();
      return;
    }
    if (this.abilityLeft() > 0) return;
    const cam = this.rig.camera;
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    this.flushInputs(); // the server must have us where we used it from
    this.net.ability([cam.position.x, cam.position.y, cam.position.z], [d.x, d.y, d.z]);
    this.protUntil = 0;
    sfx.thud(420, 0.1, 0.3);
    // The ability's object shows in the left hand: the shield for as long as it lasts, the rest briefly
    const gadget = GADGET_OF[this.character.ability];
    if (gadget) this.vm.showGadget(gadget, performance.now() + (gadget === 'shield' ? SHIELD.durationMs : GADGET_MS));
  }

  /** Fully aimed: the HUD draws the sight, a holographic hexagon floating over the gun like Valorant's (the marksman
   * rifle's telescopic sight replaces the gun; the sniper has its own full-screen scope). */
  private adsSight(now: number): boolean {
    const w = this.weapons.weapon();
    return (
      !!w &&
      !w.melee &&
      this.weapons.aimLerp > ADS_SIGHT &&
      !this.weapons.current().reloadEnd &&
      now >= this.weapons.swapUntil
    );
  }

  /** ms until the ability is ready: the dash from our own prediction, the rest from the server. */
  private abilityLeft(): number {
    if (this.character?.ability === 'dash') return this.local.state.dashCd * MS_PER_S;
    return this.players.find((p) => p.id === this.myId)?.ac ?? 0;
  }

  private onState({ players, ts, fl, tg, inf, gr, dp, wo, dz, rd }: StateSnapshot): void {
    const shielded = !!players.find((p) => p.id === this.myId)?.sh;
    const now = performance.now();
    if (!shielded) this.shieldUntil = 0;
    else if (!this.shieldUntil) this.shieldUntil = now + SHIELD.durationMs - this.net.rtt / 2;
    this.players = players;
    this.objectives.zones = dz ?? null;
    this.round = rd ?? null;
    this.syncGrenades(gr ?? []);
    // Cover walls, barrels or crates changed: the prediction must bump into the same things as the server
    const objs = this.mapObjs.sync(wo);
    if (this.abilityObjs.sync(dp ?? [], performance.now()) || objs) {
      this.colliders.length = 0;
      this.colliders.push(...liveColliders(this.map, this.mapObjs.objectsDown()), ...this.abilityObjs.walls());
    }
    this.teamScore = ts;
    this.objectives.flags = fl;
    this.infect = inf;
    this.objectives.syncTags(tg);
    // Radar: you have it, or (team modes) a teammate does
    this.radar = players.some((p) => p.rd && (p.id === this.myId || (isTeamMode(this.mode) && p.tm === this.myTeam)));
    const me = players.find((p) => p.id === this.myId);
    if (me && me.tm !== this.myTeam) {
      this.myTeam = me.tm;
      // Changed team: allies and enemies change colour, and so does the uniform on our arms
      this.remotes.invalidate();
      if (this.alive) this.setGun();
    }
    if (me && this.alive) {
      this.hp = me.h;
      if (me.mh) this.maxHp = me.mh;
      this.armor = me.ar || 0;
    }
    this.remotes.onSnapshot(players, this.myId, performance.now());
  }

  private onSpawned(d: SpawnedMessage): void {
    this.endReplay();
    this.character = CHAR_BY_ID[d.characterId];
    this.skin = d.skin || 'base';
    this.color = d.color;
    this.camo = d.camo ?? 'liso';
    this.finish = d.finish ?? 'estandar';
    this.life = d.life;
    this.damageDirs = [];
    this.local.reset(d.x, d.y, d.z);
    this.simAcc = 0;
    this.input.yaw = d.ry;
    this.input.pitch = 0;
    this.myTeam = d.team;
    this.hp = this.maxHp = d.hp;
    this.armor = 0;
    this.alive = true;
    this.protUntil = performance.now() + PLAYER.spawnProtection;
    // Clicking to respawn sooner used to fire on spawning and drop the protection at once
    this.input.clearButtons();
    this.weapons.holdFire(performance.now() + SPAWN_FIRE_GRACE_MS);
    this.everSpawned = true;
    this.deathPos = null;
    this.level = d.level;
    this.grenades = grenadesFor(this.mode, d.team);
    this.rig.reset();
    this.equip();
  }

  private die(d: KillEvent): void {
    this.alive = false;
    this.deathAt = performance.now();
    this.startReplay(d.killer);
    this.deathPos = this.rig.camera.position.clone();
    this.killerId = d.killer;
    this.killerName = d.killerName;
    this.input.clearButtons();
    // The mouse stays captured: you respawn by yourself and keep playing without clicking
  }

  // ============================================================ Death replay
  private startReplay(killerId: string): void {
    this.endReplay();
    const killer = this.remotes.all.get(killerId);
    if (killerId === this.myId || !killer?.model || !this.character) return;
    const now = this.deathAt;
    // The killer's own gun, finish and gloves, as they had it
    if (killer.weaponId) this.killVm.setGun(killer.weaponId, killer.color, killer.skin ?? 'base', killer.cm, killer.fn);
    const { color, skin, camo } = outfitFor(
      this.mode,
      this.character.id,
      this.skin,
      this.myTeam,
      this.color,
      this.camo,
    );
    const ghost = buildCharacter(this.character.id, skin, color, camo);
    ghost.holdGun(buildGun(this.weapons.weaponId(), true, color));
    const wid = this.weapons.weaponId();
    void loadGun(wid, { finish: this.finish, color, camo, withFlash: true }).then((g) => {
      if (this.replay?.ghost === ghost) ghost.holdGun(g);
    });
    ghost.group.visible = false;
    this.scene.add(ghost.group);
    this.replay = {
      killerId,
      start: now + REPLAY_DELAY_MS,
      from: now - REPLAY_MS,
      ghost,
      played: now - REPLAY_MS,
      walk: 0,
      last: null,
      killerPose: null,
      flashAt: -1e9,
    };
  }

  private endReplay(): void {
    if (this.replay?.ghost) this.scene.remove(this.replay.ghost.group);
    this.replay = null;
  }

  /** Plays the replay; false once it is over (or not started yet). */
  private playReplay(now: number): boolean {
    const r = this.replay;
    if (!r || now < r.start) return false;
    const t = r.from + (now - r.start);
    if (t > this.deathAt || this.alive) {
      this.endReplay();
      return false;
    }
    // Everybody, us included, as the killer saw it: VIEW_DELAY_MS in the past of each moment
    const seen = t - VIEW_DELAY_MS;
    const pose = this.remotes.poseAt(r.killerId, seen);
    if (!pose) {
      this.endReplay();
      return false;
    }
    this.rig.replay(pose.x, pose.y + (pose.sl || pose.cr ? PLAYER.slideEye : PLAYER.eye), pose.z, pose.ry, pose.rx);
    const dt = Math.max(1e-3, (t - r.played) / MS_PER_S);
    const me = this.selfAt(seen);
    if (r.ghost && me) {
      // Our body walks where we walked: legs swing with the distance covered
      const g = r.ghost;
      const speed = r.last ? Math.hypot(me.x - r.last.x, me.z - r.last.z) / dt : 0;
      r.walk += speed * dt * WALK_PHASE_PER_M;
      g.group.visible = true;
      g.group.position.set(me.x, me.y, me.z);
      g.group.rotation.y = me.yaw;
      g.aim.rotation.x = me.pitch;
      animateLegs(g, r.walk, speed, 0, 0, damp(GHOST_FOLLOW, dt));
      r.last = me;
    }
    // The killer's shots of that moment, again: tracer from their gun, flash and sound
    for (const s of this.shotLog) {
      if (s.id !== r.killerId || s.t <= r.played || s.t > t) continue;
      r.flashAt = now;
      const from =
        this.killVm.muzzleWorld(this.rig.camera, new THREE.Vector3()) ??
        this.rig.camera.position.clone().add(new THREE.Vector3(0, -0.15, 0));
      if (!(s.w && WEAPONS[s.w].melee))
        for (const end of s.ends) this.effects.bullet(from, new THREE.Vector3(...end), null, null, s.ends.length > 1);
      this.bus.emit('shot', { weapon: s.w, volume: REPLAY_SHOT_VOLUME });
    }
    // Their gun bobs with their speed and kicks with each replayed shot
    const kp = r.killerPose;
    const kSpeed = kp ? Math.hypot(pose.x - kp.x, pose.z - kp.z) / dt : 0;
    r.killerPose = { x: pose.x, z: pose.z };
    const killer = this.remotes.all.get(r.killerId);
    if (killer?.weaponId) {
      const since = now - r.flashAt;
      this.killVm.update(dt, now, true, {
        weapon: WEAPONS[killer.weaponId],
        speed: kSpeed,
        grounded: true,
        sliding: !!pose.sl,
        sprintLerp: 0,
        aimLerp: 0,
        kick: Math.max(0, 1 - since / REPLAY_KICK_MS),
        reloadEnd: 0,
        swapUntil: 0,
        swingAt: WEAPONS[killer.weaponId].melee ? r.flashAt : -1e9,
        flashTime: r.flashAt,
      });
    }
    r.played = t;
    return true;
  }

  /** Our pose at `t`, between the two logged frames around it. */
  private selfAt(t: number): SelfPose | null {
    const log = this.selfLog;
    for (let i = log.length - 1; i >= 0; i--) {
      const a = log[i]!;
      if (a.t > t) continue;
      const b = log[i + 1];
      if (!b) return a;
      const f = (t - a.t) / Math.max(1e-3, b.t - a.t);
      const lerp = (p: number, q: number) => p + (q - p) * f;
      return {
        t,
        x: lerp(a.x, b.x),
        y: lerp(a.y, b.y),
        z: lerp(a.z, b.z),
        yaw: dampAngle(a.yaw, b.yaw, f),
        pitch: lerp(a.pitch, b.pitch),
      };
    }
    return log[0] ?? null;
  }

  private onRemoteShot(id: string, w: keyof typeof WEAPONS | null, ends: Vec3[]): void {
    const now = performance.now();
    this.shotLog.push({ id, t: now, w, ends });
    this.shotLog = this.shotLog.filter((s) => now - s.t < REPLAY_LOG_MS);
    const r = this.remotes.markShot(id, now);
    if (!r) return;
    const from = this.remotes.muzzle(r)?.clone();
    if (!from) return;
    const feet = this.remotes.position(id);
    if (
      feet &&
      !this.isMate(r.team === -1 ? 0 : r.team) &&
      this.alive &&
      feet.distanceTo(this.renderPos) < SHOT_MARK_RANGE
    ) {
      this.addTick(feet.x, feet.z, SHOT_MARK_COLOR);
    }
    if (!(w && WEAPONS[w].melee)) {
      const pellet = ends.length > 1;
      for (const end of ends) {
        const to = new THREE.Vector3(...end);
        // The server only sends where each bullet stopped: on a collider face it hit a wall
        const n = wallNormal(to, this.colliders, this.tmpNormal);
        this.effects.bullet(from, to, n ? 'wall' : this.onPlayer(to) ? 'player' : null, n, pellet);
      }
    }
    const dist = from.distanceTo(this.rig.camera.position);
    this.bus.emit('shot', { weapon: w, volume: Math.max(0, 1 - dist / SHOT_SOUND_RANGE) * REMOTE_SHOT_VOLUME });
  }

  /** Whether a point is on someone's body (us or a drawn remote): for remote shots' blood puffs. */
  private onPlayer(p: THREE.Vector3): boolean {
    const near = (x: number, y: number, z: number) =>
      Math.abs(p.x - x) < BODY_HALF_WIDTH && Math.abs(p.z - z) < BODY_HALF_WIDTH && p.y > y && p.y < y + BODY_HEIGHT;
    if (this.alive && near(this.renderPos.x, this.renderPos.y, this.renderPos.z)) return true;
    return this.remotes.targets().some((t) => near(t.x, t.y, t.z));
  }

  private addTick(x: number, z: number, color: string): void {
    const t = performance.now();
    this.ticks.push({ key: t + Math.random(), x, z, color, t });
  }

  // ============================================================ Loop
  private simulate(frameDt: number): number {
    this.simAcc = Math.min(MAX_SIM_CATCH_UP, this.simAcc + frameDt);
    while (this.simAcc >= FIXED_DT) {
      const input = this.input.command(this.local.nextSeq(), this.weapons.slot);
      const ev = this.local.step(input, this.moveContext(input));
      if (ev.jump) this.bus.emit('jump');
      if (ev.slide) this.bus.emit('slide');
      if (ev.pad) this.bus.emit('pad');
      if (ev.dash) {
        this.bus.emit('slide'); // whoosh
        this.rig.land(-DASH_KICK);
      }
      if (ev.step) this.bus.emit('step', { volume: ev.step });
      if (ev.land) {
        this.rig.land(ev.land);
        this.bus.emit('land', { fall: ev.land });
      }
      this.simAcc -= FIXED_DT;
    }
    return this.simAcc / FIXED_DT;
  }

  private loop(): void {
    this.raf = requestAnimationFrame(this.loop);
    const frameDt = this.clock.getDelta();
    const dt = Math.min(frameDt, MAX_FRAME_DT);
    const now = performance.now();
    const st = this.local.state;

    if (this.alive) {
      const alpha = this.simulate(frameDt);
      this.local.renderPosition(alpha, dt, this.renderPos);
      this.weapons.updateAim(dt, now);
      const w = this.weapons.weapon();
      this.rig.alive(dt, {
        position: this.renderPos,
        yaw: this.input.yaw,
        pitch: this.input.pitch,
        low: st.sliding || st.crouching,
        sliding: st.sliding,
        sprinting: st.sprinting,
        speed: Math.hypot(st.vx, st.vz),
        weapon: w,
        aimLerp: this.weapons.aimLerp,
        scoped: this.weapons.scoped(),
      });
      this.weapons.update(now, dt, st);
      this.updateGrenadeAim();
      this.selfLog.push({
        t: now,
        x: this.renderPos.x,
        y: this.renderPos.y,
        z: this.renderPos.z,
        yaw: this.input.yaw,
        pitch: this.input.pitch,
      });
      while (this.selfLog.length && now - this.selfLog[0]!.t > REPLAY_LOG_MS) this.selfLog.shift();
    } else {
      if (
        this.autoChar &&
        this.deathAt &&
        now - this.deathAt >= PLAYER.respawnDelay &&
        now - this.spawnReqAt > SPAWN_RETRY_MS
      ) {
        // Automatic respawn with the chosen character
        this.spawnReqAt = now;
        this.net.spawn(this.autoChar.id, this.autoChar.look);
      }
      if (this.playReplay(now)) {
        // the camera is in the killer's eyes
      } else if (this.deathPos) this.rig.dead(dt, this.deathPos, this.remotes.position(this.killerId));
      else this.rig.orbit(now, this.map.half);
    }
    this.weapons.tickCombo(now);

    const a = this.weapons.current();
    this.vm.update(
      dt,
      now,
      // Aimed, the gun stays in view under the holographic sight; only the marksman rifle's scope replaces it
      this.alive && !this.weapons.scoped() && !(this.adsSight(now) && this.weapons.weaponId() === 'dmr'),
      this.alive
        ? {
            weapon: this.weapons.weapon(),
            speed: Math.hypot(st.vx, st.vz),
            grounded: st.grounded,
            sliding: st.sliding,
            sprintLerp: this.rig.sprintLerp,
            aimLerp: this.weapons.aimLerp,
            kick: this.weapons.kick,
            reloadEnd: a.reloadEnd,
            swapUntil: this.weapons.swapUntil,
            swingAt: this.weapons.swingAt,
            flashTime: this.weapons.flashTime,
            grenadeAim: this.grenadeAim,
            thrownAt: this.thrownAt,
          }
        : null,
    );
    const replaying = this.replay && now >= this.replay.start ? this.replay : null;
    this.remotes.update(
      dt,
      now,
      this.alive ? this.renderPos : null,
      (x, z) => this.addTick(x, z, STEP_MARK_COLOR),
      replaying ? now - (replaying.from + (now - replaying.start)) : 0,
      replaying?.killerId ?? null,
    );
    this.effects.update(dt);
    for (const g of this.flying.values()) {
      g.mesh.position.lerp(g.target, Math.min(1, dt * GRENADE_FOLLOW));
      g.mesh.rotation.x += dt * GRENADE_TUMBLE;
    }
    this.abilityObjs.update(dt, performance.now());
    this.mapObjs.update(performance.now());
    this.objectives.update(dt, now, this.objectiveSources());

    this.sendAcc += frameDt * MS_PER_S;
    if (this.sendAcc >= CLIENT_SEND_MS) this.flushInputs();

    this.hudAcc += frameDt * MS_PER_S;
    if (this.hudAcc >= HUD_MS) {
      this.hudAcc = 0;
      this.onHud(this.hudState(now));
    }

    this.renderer.clear();
    this.renderer.render(this.scene, this.rig.camera);
    if (this.vm.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.vm.scene, this.vm.camera);
    } else if (replaying && this.killVm.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.killVm.scene, this.killVm.camera);
    }
    this.stats?.update();
  }

  private objectiveSources() {
    return {
      myId: this.myId,
      carrierPose: (id: string) => {
        const g = this.remotes.all.get(id)?.model?.group;
        return g ? { position: g.position, rotationY: g.rotation.y } : null;
      },
    };
  }

  // ============================================================ HUD
  /** What the minimap draws: allies always, enemies for a moment after shooting (or always with radar). */
  minimap(now: number): MinimapView {
    const dots: MinimapView['dots'] = [];
    for (const r of this.remotes.all.values()) {
      if (!r.alive || !r.model) continue;
      const p = r.model.group.position;
      const mate = this.isMate(r.team === -1 ? 0 : r.team);
      const age = this.radar ? 0 : now - (r.lastShot || -1e9);
      if (!mate && age > SHOW_SHOT_MS) continue;
      dots.push({ x: p.x, z: p.z, mate, alpha: mate ? 1 : 1 - age / SHOW_SHOT_MS });
    }
    const { tags, flags, zones } = this.objectives.minimap(this.renderPos, this.objectiveSources());
    return {
      me: this.alive ? { x: this.renderPos.x, z: this.renderPos.z, yaw: this.input.yaw } : null,
      dots,
      tags,
      flags,
      zones,
      pickups: this.mapObjs.available(),
    };
  }

  // Screen angle of whoever shot us recently
  private damageDirections(now: number): DamageMark[] {
    this.damageDirs = this.damageDirs.filter((d) => now - d.t < DAMAGE_DIR_MS);
    return this.damageDirs.map((d) => ({
      key: d.t,
      angle: screenAngle(this.renderPos.x, this.renderPos.z, this.input.yaw, d.x, d.z),
      life: 1 - (now - d.t) / DAMAGE_DIR_MS,
    }));
  }

  private soundTicks(now: number): SoundMark[] {
    this.ticks = this.ticks.filter((t) => now - t.t < SOUND_MARK_MS);
    return this.ticks.map((t) => ({
      key: t.key,
      color: t.color,
      angle: screenAngle(this.renderPos.x, this.renderPos.z, this.input.yaw, t.x, t.z),
    }));
  }

  private hudState(now: number): HudState {
    const alive = this.alive;
    const w = alive ? this.weapons.weapon() : null;
    const a = alive ? this.weapons.current() : null;
    const st = this.local.state;
    return {
      alive,
      everSpawned: this.everSpawned,
      locked: this.input.locked,
      hp: Math.max(0, Math.ceil(this.hp)),
      maxHp: this.maxHp,
      characterId: this.character?.id,
      charName: this.character?.name,
      stamina: PLAYER.useStamina ? st.stamina / PLAYER.stamina : null,
      armor: alive ? this.armor : 0,
      radar: this.radar,
      infect: this.infect,
      staminaLow: st.staminaLock,
      sprinting: st.sprinting,
      speedFx: alive ? this.speedFx(st) : 0,
      ability: alive && this.character ? { id: this.character.ability, left: this.abilityLeft() } : null,
      shield: alive && this.shieldUntil ? Math.max(0, this.shieldUntil - now) : 0,
      shieldHit: now - this.shieldHitAt < SHIELD_FLASH_MS,
      adsSight: alive && this.adsSight(now) ? (this.weapons.loadout[this.weapons.slot] ?? null) : null,
      smoke: alive ? this.abilityObjs.smokeAt(this.rig.camera.position, now) : 0,
      weaponName: w?.name,
      mag: a?.mag,
      magSize: w?.mag,
      reloading: !!a?.reloadEnd,
      reloadPct: a?.reloadEnd && w ? Math.min(1, 1 - (a.reloadEnd - now) / w.reload) : 0,
      slot: this.weapons.slot,
      loadout: this.weapons.loadout.map((id) => WEAPONS[id].name),
      melee: !!w?.melee,
      gunLevel: this.mode === 'gungame' ? this.level + 1 : 0,
      gunTotal: this.mode === 'gungame' ? gunLadder(this.limit).length : 0,
      scoped: alive && this.weapons.scoped(),
      protect: alive ? Math.max(0, this.protUntil - now) : 0,
      hit: now - this.hitTime < HIT_FLASH_MS,
      hitMark: now - this.hitTime < HIT_MARK_MS,
      hitHead: this.hitHead,
      damage: Math.max(0, 1 - (now - this.damageTime) / DAMAGE_FLASH_MS),
      respawnIn: alive || !this.deathAt ? 0 : Math.max(0, PLAYER.respawnDelay - (now - this.deathAt)),
      killerName: this.killerName,
      players: this.players.map(({ id, n, c, k, d, tm, pg, st: streak, cp, lv, md }) => ({
        id,
        n,
        c,
        k,
        d,
        tm,
        pg,
        st: streak,
        cp,
        lv,
        md,
      })),
      spread: w ? this.weapons.spread(w, st) + this.weapons.kick * 0.02 : 0,
      aim: this.weapons.aimLerp,
      dmgDirs: this.damageDirections(now),
      mode: this.mode,
      myTeam: this.myTeam,
      hitKey: this.hitTime,
      hitRed: this.hitRed,
      combo: this.weapons.combo,
      comboKey: this.weapons.comboAt,
      ticks: this.soundTicks(now),
      shotKey: this.weapons.flashTime,
      damageKey: this.damageTime,
      deathKey: this.deathAt,
      teamScore: this.teamScore,
      flags: this.objectives.flags,
      ping: Math.round(this.net.rtt),
      grenades: alive ? this.grenades : 0,
      grenadeAim: this.grenadeAim,
      zones: this.objectives.zones,
      round: this.round,
      replay: !!this.replay && now >= this.replay.start,
    };
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w / h);
    this.vm.resize(w / h);
    this.killVm.resize(w / h);
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.stats?.dispose();
    for (const f of this.offs) f();
    this.net.dispose();
    this.input.dispose();
    this.remotes.dispose();
    this.objectives.dispose();
    this.effects.dispose();
    this.abilityObjs.dispose();
    this.mapObjs.dispose();
    this.vm.dispose();
    this.killVm.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // free the WebGL context now: Chrome keeps only ~16 alive
    this.renderer.domElement.remove();
  }
}
