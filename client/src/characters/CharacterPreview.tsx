import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHAR_BY_ID, type CharacterId } from '@blockshot/shared';
import { buildCharacter, type CharacterModel } from '../game/render/models';
import { loadGun } from '../game/render/gunAssets';
import type { Look } from './looks';

// The approved proposal's studio ("Mejorado" in .impeccable/mocks/propuesta/proto.js), value for value: same
// renderer, lights, camera, stand and material treatment, so the characters come out in the same colours.

const MAX_PIXEL_RATIO = 1.5;
/** One full turn every this many seconds while idle. */
const TURN_SECONDS = 8;
const DRAG_SPEED = 0.012;
const MAX_DT = 0.05;
const GUN_SCALE = 1.05;
const AIM_TILT = 0.12;
/** Arma tab: both guns up close, one above the other. */
const SHOWCASE_SCALE = 2.2;
const SHOWCASE_Y = [1.25, 0.55] as const;
const SWAY = 0.45;
/** Spin-in on a new character: speed of the 0→1 ramp (per second) and extra turn (rad). */
const POP_SPEED = 2.5;
const POP_TURN = Math.PI * 0.6;
const RING_OPACITY = 0.55;

// Fabric and cordura for cloth that has no texture yet (made once, on first use)
let cloth: { weave: THREE.CanvasTexture; cordura: THREE.CanvasTexture } | null = null;
function noiseTex(size: number, draw: (g: CanvasRenderingContext2D, n: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function clothTextures() {
  if (cloth) return cloth;
  const weave = noiseTex(64, (g, n) => {
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 2)
      for (let x = 0; x < n; x += 2) {
        const v = 222 + ((x * 7 + y * 13) % 5) * 5 + Math.random() * 12;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x + ((y / 2) % 2), y, 1, 2);
      }
  });
  weave.colorSpace = THREE.SRGBColorSpace;
  weave.repeat.set(5, 5);
  const cordura = noiseTex(32, (g, n) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 150 + ((x ^ y) & 3) * 25 + Math.random() * 30;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 1, 1);
      }
  });
  cordura.repeat.set(4, 4);
  return (cloth = { weave, cordura });
}

/** The studio's look: matte, sober cloth and soft metal (proto.js `improve`). The held gun keeps its finish. */
function improve(model: CharacterModel): void {
  const held = new Set<THREE.Object3D>();
  model.hand.traverse((o) => held.add(o));
  model.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || held.has(o)) return;
    const m = (o.material as THREE.MeshStandardMaterial).clone();
    if (m.metalness < 0.3) {
      if (!m.map) {
        const { weave, cordura } = clothTextures();
        m.map = weave;
        m.bumpMap = cordura;
        m.bumpScale = 0.3;
      }
      m.roughness = Math.max(m.roughness, 0.9); // matte cloth: no sheen
      m.color.offsetHSL(0, -0.12, 0).multiplyScalar(0.72); // sober, tactical tones instead of pastel
    }
    if (m.metalness >= 0.3) m.roughness = Math.max(m.roughness, 0.55);
    m.envMapIntensity = m.metalness >= 0.3 ? 0.45 : 0.08;
    o.material = m;
  });
}

const castShadows = (o: THREE.Object3D) =>
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) m.castShadow = true;
  });

interface View {
  holder: THREE.Group;
  ringMat: THREE.MeshBasicMaterial;
  rim: THREE.DirectionalLight;
  spin: boolean;
  pop: number;
  build: number;
}

declare global {
  interface Window {
    /** Dev only, for screenshots: hold the turntable at an angle (same hook as the proposal). */
    studioPose?: (radians: number) => void;
  }
}

// 3D studio: the character turning on a ring in its colour, soft key light and a rim in the same colour.
// It can be turned by dragging. On the Arma tab it shows the two guns, one above the other, swaying side-on.
export default function CharacterPreview({
  charId,
  look,
  showcase = false,
}: {
  charId: CharacterId;
  look: Look;
  showcase?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View | null>(null);
  const lastChar = useRef(charId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.3, 5.5);
    camera.lookAt(0, 0.98, 0);

    scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2724, 0.55));
    const key = new THREE.DirectionalLight(0xfff3e6, 1.3);
    key.position.set(2.2, 4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2.4, bottom: -0.5 });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(-2.5, 2.4, -2.8);
    scene.add(rim);

    // Shadow catcher and a thin ring in the character colour (the canvas is transparent over the map)
    const base = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.ShadowMaterial({ opacity: 0.5 }));
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    scene.add(base);
    const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: RING_OPACITY });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.06, 1.1, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);
    const holder = new THREE.Group();
    scene.add(holder);
    const v: View = { holder, ringMat, rim, spin: true, pop: 1, build: 0 };
    view.current = v;

    let angle = 0.5;
    let frozen = false;
    if (import.meta.env.DEV) window.studioPose = (a) => ((frozen = true), (angle = a), (v.pop = 1));
    let drag: number | null = null;
    const down = (e: PointerEvent) => {
      drag = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag === null) return;
      angle += (e.clientX - drag) * DRAG_SPEED;
      drag = e.clientX;
    };
    const up = () => {
      drag = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(MAX_DT, clock.getDelta());
      if (drag === null && !frozen) angle += dt * ((Math.PI * 2) / TURN_SECONDS);
      // On a new character: a quick spin-in and the ring swelling out
      v.pop = Math.min(1, v.pop + dt * POP_SPEED);
      const e = 1 - (1 - v.pop) ** 3;
      holder.rotation.y = v.spin ? Math.PI + angle + (1 - e) * POP_TURN : Math.sin(angle * 0.6) * SWAY;
      holder.scale.setScalar(0.9 + 0.1 * e);
      ring.scale.setScalar(1 + (1 - e) * 0.35);
      ringMat.opacity = RING_OPACITY * e + (1 - e) * 0.9;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      if (import.meta.env.DEV) delete window.studioPose;
      view.current = null;
      // The models' geometries are shared caches the game also draws: only this studio's own pieces are disposed;
      // the renderer frees everything it uploaded with its context.
      for (const m of [base, ring]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // free the WebGL context now: Chrome keeps only ~16 alive
    };
  }, []);

  // Changing character, look or tab rebuilds the content (guns load asynchronously; the newest build wins)
  const { skin, color, camo, finish } = look;
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const n = ++v.build;
    const ch = CHAR_BY_ID[charId];
    const gunLook = { finish, color, camo };
    const pop = lastChar.current !== charId;
    lastChar.current = charId;
    const done = (content: THREE.Object3D) => {
      if (view.current !== v || n !== v.build) return;
      v.holder.clear();
      v.holder.add(content);
      v.spin = !showcase;
      v.ringMat.color.set(color);
      v.rim.color.set(color).lerp(new THREE.Color(0xffffff), 0.35);
      if (pop) v.pop = 0;
    };
    if (showcase) {
      void Promise.all([loadGun(ch.primary, gunLook), loadGun(ch.secondary, gunLook)]).then((guns) => {
        const g = new THREE.Group();
        guns.forEach((gun, i) => {
          gun.scale.setScalar(SHOWCASE_SCALE);
          gun.position.set(0, SHOWCASE_Y[i]!, 0);
          gun.rotation.y = Math.PI / 2;
          castShadows(gun);
          g.add(gun);
        });
        done(g);
      });
    } else {
      const model = buildCharacter(ch.id, skin, color, camo);
      castShadows(model.group); // before the gun is held: like the proposal, the gun casts no shadow
      void loadGun(ch.primary, gunLook).then((gun) => {
        gun.scale.setScalar(GUN_SCALE);
        model.holdGun(gun);
        model.aim.rotation.x = AIM_TILT;
        improve(model);
        done(model.group);
      });
    }
  }, [charId, skin, color, camo, finish, showcase]);

  return <canvas id="studio" ref={canvasRef} />;
}
