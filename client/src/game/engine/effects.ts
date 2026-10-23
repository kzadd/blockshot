// Short-lived visual effects: bullet tracers, impact dots and floating damage numbers. Every object comes
// from a pool, so shooting does not allocate meshes, materials or canvases.
import * as THREE from 'three';
import { Pool } from './pool';

const TRACER_LIFE = 0.08;
const TRACER_WIDTH = 0.025;
const TRACER_MIN_LENGTH = 0.5;
const TRACER_COLOR = 0xfff1a8;
const TRACER_OPACITY = 0.85;
const IMPACT_LIFE = 0.3;
const IMPACT_ON_PLAYER = 0xff4d4d;
const IMPACT_ON_WALL = 0x3a3a3a;
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

const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
const impactGeo = new THREE.SphereGeometry(0.08, 6, 6);

interface Active {
  obj: THREE.Mesh | THREE.Sprite;
  mat: THREE.MeshBasicMaterial | THREE.SpriteMaterial;
  life: number;
  max: number;
  rise: number;
  pop: boolean;
  release: () => void;
}

interface NumberSprite {
  sprite: THREE.Sprite;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
}

export class Effects {
  private readonly active: Active[] = [];
  private readonly tracers = new Pool(
    () =>
      new THREE.Mesh(
        tracerGeo,
        new THREE.MeshBasicMaterial({ color: TRACER_COLOR, transparent: true, opacity: TRACER_OPACITY }),
      ),
  );
  private readonly impacts = new Pool(
    () => new THREE.Mesh(impactGeo, new THREE.MeshBasicMaterial({ color: IMPACT_ON_WALL, transparent: true })),
  );
  private readonly numbers = new Pool<NumberSprite>(() => {
    const c = document.createElement('canvas');
    c.width = NUMBER_CANVAS_W;
    c.height = NUMBER_CANVAS_H;
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, sizeAttenuation: false }),
    );
    sprite.renderOrder = 10;
    return { sprite, ctx: c.getContext('2d')!, tex };
  });

  constructor(private readonly scene: THREE.Scene) {}

  private start(a: Omit<Active, 'pop' | 'rise'> & Partial<Pick<Active, 'pop' | 'rise'>>): void {
    this.scene.add(a.obj);
    this.active.push({ rise: 0, pop: false, ...a });
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const len = from.distanceTo(to);
    if (len < TRACER_MIN_LENGTH) return;
    const mesh = this.tracers.acquire();
    mesh.scale.set(TRACER_WIDTH, TRACER_WIDTH, len);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.lookAt(to);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    this.start({ obj: mesh, mat, life: TRACER_LIFE, max: TRACER_LIFE, release: () => this.tracers.release(mesh) });
  }

  impact(at: THREE.Vector3, onPlayer: boolean): void {
    const mesh = this.impacts.acquire();
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(onPlayer ? IMPACT_ON_PLAYER : IMPACT_ON_WALL);
    mesh.position.copy(at);
    this.start({ obj: mesh, mat, life: IMPACT_LIFE, max: IMPACT_LIFE, release: () => this.impacts.release(mesh) });
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
    this.start({
      obj: n.sprite,
      mat: n.sprite.material,
      life: NUMBER_LIFE,
      max: NUMBER_LIFE,
      rise: NUMBER_RISE,
      pop: true,
      release: () => this.numbers.release(n),
    });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i]!;
      e.life -= dt;
      e.mat.opacity = Math.max(0, e.life / e.max);
      if (e.rise) e.obj.position.y += e.rise * dt;
      if (e.pop) {
        const k = 1 + NUMBER_POP * Math.max(0, 1 - (e.max - e.life) / (e.max * NUMBER_POP_PART));
        e.obj.scale.set(NUMBER_SCALE_X * k, NUMBER_SCALE_Y * k, 1);
      }
      if (e.life <= 0) {
        this.scene.remove(e.obj);
        e.release();
        this.active.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const e of this.active) this.scene.remove(e.obj);
    this.active.length = 0;
  }
}
