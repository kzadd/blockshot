// Short-lived visual effects: bullet tracers, bullet holes, impact puffs and sparks, and floating damage
// numbers. Every object comes from a pool and the textures are drawn once, so shooting does not allocate
// meshes, materials or canvases.
import * as THREE from 'three';
import { Pool } from './pool';

// Tracers: a bright streak that travels from the muzzle to the hit point
const TRACER_SPEED = 260;
/** Short shots still show the streak moving for at least this long (s). */
const TRACER_MIN_TIME = 0.07;
const TRACER_STREAK = 5;
/** The streak is never longer than this part of the shot. */
const TRACER_STREAK_PART = 0.6;
const TRACER_WIDTH = 0.035;
const TRACER_MIN_LENGTH = 0.5;
const TRACER_COLOR = 0xffd98a;
const TRACER_OPACITY = 1;
/** Shotgun pellets: thinner, shorter and dimmer, so ten of them do not light up the screen. */
const PELLET_WIDTH = 0.022;
const PELLET_STREAK = 2.5;
const PELLET_OPACITY = 0.6;
// Bullet holes
const HOLE_LIFE = 5;
const HOLE_FADE = 1.5;
const HOLE_CAP = 64;
const HOLE_SIZE = 0.09;
const HOLE_SIZE_JITTER = 0.03;
const HOLE_OFFSET = 0.004;
// Impact puffs and sparks
const PUFF_LIFE = 0.4;
const PUFF_SIZE = 0.16;
const PUFF_GROW = 0.5;
const PUFF_RISE = 0.35;
const WALL_DUST = 0xb9b2a4;
const BLOOD = 0xd92b2b;
const SPARK_LIFE = 0.28;
const SPARK_SIZE = 0.035;
const SPARK_SPEED = 3.2;
const SPARK_SPREAD = 0.8;
const SPARK_GRAVITY = 9;
const SPARK_COLOR = 0xffc266;
const SPARKS_PER_HIT = 4;
const SPARKS_PER_PELLET = 1;
const DROPS_PER_HIT = 4;
const DROP_SIZE = 0.05;
const POOL_LARGE = 128;
// Damage numbers
const NUMBER_LIFE = 0.7;
const NUMBER_RISE = 0.9;
const NUMBER_SCALE_X = 0.1;
const NUMBER_SCALE_Y = 0.05;
/** Numbers pop in from 1.3× during the first 18 % of their life. */
const NUMBER_POP = 0.3;
const NUMBER_POP_PART = 0.18;
const NUMBER_JITTER = 0.4;
const NUMBER_LIFT = 0.2;
const NUMBER_CANVAS_W = 128;
const NUMBER_CANVAS_H = 64;
const TEX_SIZE = 64;

// ------------------------------------------------------------ Textures (drawn once)
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Streak: transparent tail (v=0) to a hot head (v=1), with a bright core across its width. */
const tracerTexture = (): THREE.CanvasTexture =>
  canvasTexture(16, TEX_SIZE, (g) => {
    for (let y = 0; y < TEX_SIZE; y++) {
      const along = 1 - y / (TEX_SIZE - 1); // canvas top = v 1 = head
      for (let x = 0; x < 16; x++) {
        const across = 1 - Math.abs(x - 7.5) / 8;
        const a = Math.pow(along, 1.6) * Math.pow(across, 2);
        const core = across > 0.75 ? 1 : 0.7;
        g.fillStyle = `rgba(255,${Math.round(235 * core)},${Math.round(190 * core)},${a})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  });

/** Bullet hole: black core, scorched ring and a lighter chipped rim. */
const holeTexture = (): THREE.CanvasTexture =>
  canvasTexture(TEX_SIZE, TEX_SIZE, (g) => {
    const h = TEX_SIZE / 2;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Chipped rim: an irregular light polygon
    g.fillStyle = 'rgba(205,196,178,0.55)';
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = h * (0.62 + rnd() * 0.3);
      g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    // Scorch
    const scorch = g.createRadialGradient(h, h, h * 0.15, h, h, h * 0.62);
    scorch.addColorStop(0, 'rgba(25,22,20,0.95)');
    scorch.addColorStop(1, 'rgba(40,36,32,0)');
    g.fillStyle = scorch;
    g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    // Cracks
    g.strokeStyle = 'rgba(30,28,26,0.7)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      g.beginPath();
      g.moveTo(h + Math.cos(a) * h * 0.2, h + Math.sin(a) * h * 0.2);
      g.lineTo(h + Math.cos(a + 0.2) * h * (0.6 + rnd() * 0.3), h + Math.sin(a + 0.2) * h * (0.6 + rnd() * 0.3));
      g.stroke();
    }
    // Core
    g.fillStyle = '#0b0a09';
    g.beginPath();
    g.arc(h, h, h * 0.24, 0, Math.PI * 2);
    g.fill();
  });

/** Soft round blob for puffs, sparks and drops (white, tinted by the material). */
const softTexture = (): THREE.CanvasTexture =>
  canvasTexture(TEX_SIZE / 2, TEX_SIZE / 2, (g) => {
    const h = TEX_SIZE / 4;
    const grad = g.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, h * 2, h * 2);
  });

/** Two crossed quads along +Z (tail at z=-0.5, head at z=+0.5), so the streak reads from any side. */
function tracerGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 1);
  a.rotateX(-Math.PI / 2); // v now runs along -Z → flip so v=1 is the head (+Z)
  a.scale(1, 1, -1);
  const b = a.clone().rotateZ(Math.PI / 2);
  const pos = [...a.attributes.position!.array, ...b.attributes.position!.array];
  const uv = [...a.attributes.uv!.array, ...b.attributes.uv!.array];
  const idx = [...a.index!.array, ...[...b.index!.array].map((i) => i + 4)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------ Effect records
/** What a bullet stopped on: its impact effects play when the tracer gets there. */
export type BulletHit = 'wall' | 'player' | null;

interface Tracer {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dir: THREE.Vector3;
  len: number;
  head: number;
  speed: number;
  streak: number;
  pellet: boolean;
  hit: BulletHit;
  /** surface normal of a wall hit (null when unknown) */
  normal: THREE.Vector3 | null;
  normalStore: THREE.Vector3;
  arrived: boolean;
}

interface Hole {
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  life: number;
}

interface Particle {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  grow: number;
  gravity: number;
  opacity: number;
}

interface NumberSprite {
  sprite: THREE.Sprite;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  life: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class Effects {
  private readonly tracerGeo = tracerGeometry();
  private readonly holeGeo = new THREE.PlaneGeometry(1, 1);
  private readonly tracerTex = tracerTexture();
  private readonly holeTex = holeTexture();
  private readonly softTex = softTexture();

  private readonly liveTracers: Tracer[] = [];
  private readonly liveHoles: Hole[] = [];
  private readonly liveParticles: Particle[] = [];
  private readonly liveNumbers: NumberSprite[] = [];

  private readonly tracers = new Pool<Tracer>(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: this.tracerTex,
      color: TRACER_COLOR,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.tracerGeo, mat);
    mesh.frustumCulled = false;
    return {
      mesh,
      mat,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      len: 0,
      head: 0,
      speed: 0,
      streak: 0,
      pellet: false,
      hit: null,
      normal: null,
      normalStore: new THREE.Vector3(),
      arrived: false,
    };
  });
  private readonly holes = new Pool<Hole>(() => {
    const mat = new THREE.MeshLambertMaterial({
      map: this.holeTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    return { mesh: new THREE.Mesh(this.holeGeo, mat), mat, life: 0 };
  }, HOLE_CAP);
  private readonly particles = new Pool<Particle>(() => {
    const mat = new THREE.SpriteMaterial({ map: this.softTex, transparent: true, depthWrite: false });
    return {
      sprite: new THREE.Sprite(mat),
      mat,
      vel: new THREE.Vector3(),
      life: 0,
      max: 1,
      size: 1,
      grow: 0,
      gravity: 0,
      opacity: 1,
    };
  }, POOL_LARGE);
  private readonly numbers = new Pool<NumberSprite>(() => {
    const c = document.createElement('canvas');
    c.width = NUMBER_CANVAS_W;
    c.height = NUMBER_CANVAS_H;
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }),
    );
    sprite.renderOrder = 10;
    return { sprite, ctx: c.getContext('2d')!, tex, life: 0 };
  });

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * A bullet: a streak that travels from `from` to `to`, then the impact (hole, dust and sparks on a wall
   * facing `normal`, a red puff on a player). `pellet` = one of many (shotgun), drawn lighter.
   */
  bullet(from: THREE.Vector3, to: THREE.Vector3, hit: BulletHit, normal: THREE.Vector3 | null, pellet = false): void {
    const len = from.distanceTo(to);
    if (len < TRACER_MIN_LENGTH) {
      this.hitAt(to, hit, normal, pellet);
      return;
    }
    const t = this.tracers.acquire();
    t.from.copy(from);
    t.to.copy(to);
    t.pellet = pellet;
    t.hit = hit;
    t.normal = normal ? t.normalStore.copy(normal) : null;
    t.arrived = false;
    t.dir.subVectors(to, from).divideScalar(len);
    t.len = len;
    t.streak = Math.min(pellet ? PELLET_STREAK : TRACER_STREAK, len * TRACER_STREAK_PART);
    t.speed = Math.min(TRACER_SPEED, (len + t.streak) / TRACER_MIN_TIME);
    t.head = 0;
    const width = pellet ? PELLET_WIDTH : TRACER_WIDTH;
    t.mesh.scale.set(width, width, 0.001);
    t.mesh.quaternion.setFromUnitVectors(Z_AXIS, t.dir);
    t.mat.opacity = pellet ? PELLET_OPACITY : TRACER_OPACITY;
    this.scene.add(t.mesh);
    this.liveTracers.push(t);
  }

  private hitAt(at: THREE.Vector3, hit: BulletHit, normal: THREE.Vector3 | null, pellet: boolean): void {
    if (!hit) return;
    if (hit === 'wall' && normal) this.bulletHole(at, normal);
    this.impact(at, hit === 'player', normal, pellet);
  }

  /** A dark hole with a chipped rim on a wall, facing `normal`; fades out after a few seconds. */
  private bulletHole(at: THREE.Vector3, normal: THREE.Vector3): void {
    if (this.liveHoles.length >= HOLE_CAP) this.endHole(0);
    const h = this.holes.acquire();
    h.mesh.position.copy(at).addScaledVector(normal, HOLE_OFFSET);
    h.mesh.quaternion.setFromUnitVectors(Z_AXIS, normal);
    h.mesh.rotateZ(Math.random() * Math.PI * 2);
    h.mesh.scale.setScalar(HOLE_SIZE + (Math.random() - 0.5) * HOLE_SIZE_JITTER);
    h.mat.opacity = 1;
    h.life = HOLE_LIFE;
    this.scene.add(h.mesh);
    this.liveHoles.push(h);
  }

  /**
   * Impact: dust and sparks off a wall (pushed out along `normal` when known), or a red puff and drops
   * on a player. `pellet` = one of many, so fewer particles.
   */
  private impact(at: THREE.Vector3, onPlayer: boolean, normal: THREE.Vector3 | null, pellet: boolean): void {
    const n = normal ?? UP;
    const k = pellet ? 0.6 : 1;
    this.particle(
      at,
      onPlayer ? BLOOD : WALL_DUST,
      PUFF_SIZE * k,
      PUFF_GROW * k,
      PUFF_LIFE,
      0,
      -PUFF_RISE,
      0.8,
      n,
      0.3,
    );
    const count = onPlayer ? DROPS_PER_HIT : pellet ? SPARKS_PER_PELLET : SPARKS_PER_HIT;
    for (let i = 0; i < count; i++) {
      if (onPlayer)
        this.particle(at, BLOOD, DROP_SIZE, 0, SPARK_LIFE * 1.5, SPARK_SPEED * 0.6, SPARK_GRAVITY, 0.9, n, 1);
      else this.particle(at, SPARK_COLOR, SPARK_SIZE, 0, SPARK_LIFE, SPARK_SPEED, SPARK_GRAVITY, 1, n, 1, true);
    }
  }

  private particle(
    at: THREE.Vector3,
    color: number,
    size: number,
    grow: number,
    life: number,
    speed: number,
    gravity: number,
    opacity: number,
    normal: THREE.Vector3,
    spread: number,
    additive = false,
  ): void {
    const p = this.particles.acquire();
    p.mat.color.setHex(color);
    p.mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.mat.opacity = opacity;
    p.opacity = opacity;
    p.sprite.position.copy(at).addScaledVector(normal, size * 0.5);
    p.vel
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(SPARK_SPREAD * 2 * spread)
      .add(normal)
      .normalize()
      .multiplyScalar(speed * (0.5 + Math.random() * 0.5));
    p.sprite.scale.setScalar(size);
    p.size = size;
    p.grow = grow;
    p.gravity = gravity;
    p.life = p.max = life;
    this.scene.add(p.sprite);
    this.liveParticles.push(p);
  }

  damageNumber(at: readonly [number, number, number], dmg: number, head: boolean, kill: boolean): void {
    const n = this.numbers.acquire();
    const g = n.ctx;
    g.clearRect(0, 0, NUMBER_CANVAS_W, NUMBER_CANVAS_H);
    const px = (kill ? 32 : head ? 28 : 22) * 1.6;
    g.font = `${px}px Bungee, 'Arial Black', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9;
    g.strokeStyle = '#1b2a4a';
    g.strokeText(String(dmg), 64, 34);
    g.fillStyle = kill ? '#ff4d4d' : head ? '#ffc93c' : '#ffffff';
    g.fillText(String(dmg), 64, 34);
    n.tex.needsUpdate = true;
    n.sprite.scale.set(NUMBER_SCALE_X, NUMBER_SCALE_Y, 1);
    n.sprite.position.set(
      at[0] + (Math.random() - 0.5) * NUMBER_JITTER,
      at[1] + NUMBER_LIFT,
      at[2] + (Math.random() - 0.5) * NUMBER_JITTER,
    );
    n.sprite.material.opacity = 1;
    n.life = NUMBER_LIFE;
    this.scene.add(n.sprite);
    this.liveNumbers.push(n);
  }

  update(dt: number): void {
    this.updateTracers(dt);
    for (let i = this.liveHoles.length - 1; i >= 0; i--) {
      const h = this.liveHoles[i]!;
      h.life -= dt;
      h.mat.opacity = Math.min(1, h.life / HOLE_FADE);
      if (h.life <= 0) this.endHole(i);
    }
    for (let i = this.liveParticles.length - 1; i >= 0; i--) {
      const p = this.liveParticles[i]!;
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(p.size + p.grow * (1 - k));
      p.mat.opacity = p.opacity * k;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        this.particles.release(p);
        this.liveParticles.splice(i, 1);
      }
    }
    for (let i = this.liveNumbers.length - 1; i >= 0; i--) {
      const n = this.liveNumbers[i]!;
      n.life -= dt;
      n.sprite.material.opacity = Math.max(0, n.life / NUMBER_LIFE);
      n.sprite.position.y += NUMBER_RISE * dt;
      const pop = 1 + NUMBER_POP * Math.max(0, 1 - (NUMBER_LIFE - n.life) / (NUMBER_LIFE * NUMBER_POP_PART));
      n.sprite.scale.set(NUMBER_SCALE_X * pop, NUMBER_SCALE_Y * pop, 1);
      if (n.life <= 0) {
        this.scene.remove(n.sprite);
        this.numbers.release(n);
        this.liveNumbers.splice(i, 1);
      }
    }
  }

  /** The head runs ahead at `speed`; the tail follows `streak` metres behind and both stop at the hit. */
  private updateTracers(dt: number): void {
    for (let i = this.liveTracers.length - 1; i >= 0; i--) {
      const t = this.liveTracers[i]!;
      t.head += t.speed * dt;
      if (!t.arrived && t.head >= t.len) {
        t.arrived = true;
        this.hitAt(t.to, t.hit, t.normal, t.pellet);
      }
      const head = Math.min(t.head, t.len);
      const tail = Math.min(Math.max(0, t.head - t.streak), t.len);
      if (tail >= t.len) {
        this.scene.remove(t.mesh);
        this.tracers.release(t);
        this.liveTracers.splice(i, 1);
        continue;
      }
      t.mesh.position.copy(t.from).addScaledVector(t.dir, (head + tail) / 2);
      t.mesh.scale.z = Math.max(head - tail, 0.001);
    }
  }

  private endHole(i: number): void {
    const h = this.liveHoles[i]!;
    this.scene.remove(h.mesh);
    this.holes.release(h);
    this.liveHoles.splice(i, 1);
  }

  dispose(): void {
    for (const t of this.liveTracers) this.scene.remove(t.mesh);
    for (const h of this.liveHoles) this.scene.remove(h.mesh);
    for (const p of this.liveParticles) this.scene.remove(p.sprite);
    for (const n of this.liveNumbers) this.scene.remove(n.sprite);
    this.liveTracers.length = this.liveHoles.length = this.liveParticles.length = this.liveNumbers.length = 0;
    for (const res of [this.tracerGeo, this.holeGeo, this.tracerTex, this.holeTex, this.softTex]) res.dispose();
  }
}
