// The game client: owns the renderer and the loop (outside React) and wires input, prediction, remote
// players, weapons, effects and objectives. React only receives a HUD summary a few times per second.
import * as THREE from 'three';
import {
  CHAR_BY_ID,
  CLIENT_SEND_MS,
  FIXED_DT,
  INFECT,
  PLAYER,
  WEAPONS,
  WEAPON_HANDLING,
  getColliders,
  gunLadder,
  isTeamMode,
  loadoutOf,
  type Character,
  type Collider,
  type GameMap,
  type InfectSnapshot,
  type KillEvent,
  type ModeId,
  type MoveContext,
  type MoveInput,
  type PlayerSnapshot,
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
import { buildWorld } from '../render/world';
import { CameraRig } from './cameraRig';
import { createDevStats, type FrameStats } from './devStats';
import { Effects } from './effects';
import { EventBus } from './events';
import { InputController } from './input';
import { LocalPlayer } from './localPlayer';
import { NetClient } from './netClient';
import { Objectives } from './objectives';
import { RemotePlayers, outfitFor } from './remotePlayers';
import { screenAngle } from './util';
import { ViewModel } from './viewModel';
import { WeaponController } from './weapons';

const HUD_MS = 1000 / 15;
const MAX_PIXEL_RATIO = 1.5;
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
const DAMAGE_DIR_MS = 1200;
const DAMAGE_FLASH_MS = 600;
const SOUND_MARK_MS = 1000;
const HIT_FLASH_MS = 220;
const HIT_MARK_MS = 300;
/** Enemy gunshots closer than this leave a mark around the crosshair. */
const SHOT_MARK_RANGE = 45;
/** Gunshots fade out with distance and are silent from this far (m). */
const SHOT_SOUND_RANGE = 70;
const REMOTE_SHOT_VOLUME = 0.8;
const SHOT_MARK_COLOR = '#ffc93c';
const STEP_MARK_COLOR = '#f7f9fc';
/** Enemies on the minimap appear after shooting and fade out in this time (ms). */
const SHOW_SHOT_MS = 1500;
const DEFAULT_ADS_SENS = 0.9;

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
  autoChar: { id: string; skin: string; color?: string } | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly vm: ViewModel;
  private readonly colliders: Collider[];
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
  private adsSens = DEFAULT_ADS_SENS;
  private colorblind: Settings['colorblind'] | undefined;

  constructor(
    private readonly container: HTMLElement,
    socket: GameSocket,
    private readonly myId: string,
    private readonly onHud: HudListener,
    private readonly map: GameMap,
    private readonly mode: ModeId = 'ffa',
    private readonly limit = 0,
  ) {
    this.colliders = getColliders(map);
    const aspect = container.clientWidth / container.clientHeight;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    container.appendChild(r.domElement);

    buildWorld(this.scene, map);
    this.rig = new CameraRig(getSettings().fov, aspect, map.half * 10);
    this.vm = new ViewModel(aspect);
    this.effects = new Effects(this.scene);
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
        tracer: (a, b) => this.effects.tracer(a, b),
        impact: (at, onPlayer) => this.effects.impact(at, onPlayer),
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
    const { color, skin } = outfitFor(this.mode, this.character.id, this.skin, this.myTeam, this.color);
    this.vm.setGun(this.weapons.weaponId(), color, skin);
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
    net.on('damaged', (d) => {
      this.hp = d.hp;
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
      if (d.victim === this.myId) this.die(d);
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
    net.on('tag', (d) => this.bus.emit('tag', { confirm: d.type === 'confirm' }));
    net.on('flag', (d) => this.bus.emit('flag', { type: d.type }));
    net.on('match:end', () => {
      this.alive = false;
      this.deathPos = null;
      this.deathAt = 0;
      document.exitPointerLock?.();
    });
    net.on('match:start', () => {
      // Respawn almost at once with the same character
      this.killerName = '';
      this.deathAt = performance.now() - PLAYER.respawnDelay + RESTART_RESPAWN_MS;
    });
  }

  private flushInputs(): void {
    this.net.inputs(this.local.takeUnsent());
    this.sendAcc = 0;
  }

  /** Spawn now (first time, or after picking a character once the countdown ended). */
  spawn(characterId: string, skin: string, color?: string): void {
    this.autoChar = { id: characterId, skin, color };
    const now = performance.now();
    if (this.alive || (this.deathAt && now - this.deathAt < PLAYER.respawnDelay)) return;
    this.spawnReqAt = now;
    this.net.spawn(characterId, skin, color);
  }

  requestLock(): void {
    this.input.requestLock();
  }

  private onState({ players, ts, fl, tg, inf }: StateSnapshot): void {
    this.players = players;
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
    this.character = CHAR_BY_ID[d.characterId];
    this.skin = d.skin || 'base';
    this.color = d.color;
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
    this.rig.reset();
    this.equip();
  }

  private die(d: KillEvent): void {
    this.alive = false;
    this.deathAt = performance.now();
    this.deathPos = this.rig.camera.position.clone();
    this.killerId = d.killer;
    this.killerName = d.killerName;
    this.input.clearButtons();
    // The mouse stays captured: you respawn by yourself and keep playing without clicking
  }

  private onRemoteShot(id: string, w: keyof typeof WEAPONS | null, ends: Vec3[]): void {
    const now = performance.now();
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
      for (const end of ends) {
        const to = new THREE.Vector3(...end);
        this.effects.tracer(from, to);
        this.effects.impact(to, false);
      }
    }
    const dist = from.distanceTo(this.rig.camera.position);
    this.bus.emit('shot', { weapon: w, volume: Math.max(0, 1 - dist / SHOT_SOUND_RANGE) * REMOTE_SHOT_VOLUME });
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
    } else {
      if (
        this.autoChar &&
        this.deathAt &&
        now - this.deathAt >= PLAYER.respawnDelay &&
        now - this.spawnReqAt > SPAWN_RETRY_MS
      ) {
        // Automatic respawn with the chosen character
        this.spawnReqAt = now;
        this.net.spawn(this.autoChar.id, this.autoChar.skin, this.autoChar.color);
      }
      if (this.deathPos) this.rig.dead(dt, this.deathPos, this.remotes.position(this.killerId));
      else this.rig.orbit(now, this.map.half);
    }
    this.weapons.tickCombo(now);

    const a = this.weapons.current();
    this.vm.update(
      dt,
      now,
      this.alive && !this.weapons.scoped(),
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
          }
        : null,
    );
    this.remotes.update(dt, now, this.alive ? this.renderPos : null, (x, z) => this.addTick(x, z, STEP_MARK_COLOR));
    this.effects.update(dt);
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
    const { tags, flags } = this.objectives.minimap(this.renderPos, this.objectiveSources());
    return {
      me: this.alive ? { x: this.renderPos.x, z: this.renderPos.z, yaw: this.input.yaw } : null,
      dots,
      tags,
      flags,
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
      players: this.players.map(({ id, n, c, k, d, tm, pg, st: streak, cp, lv }) => ({
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
    };
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w / h);
    this.vm.resize(w / h);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
