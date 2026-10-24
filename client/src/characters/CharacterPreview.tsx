import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CHAR_BY_ID, type CharacterId } from '@blockshot/shared';
import { buildCharacter, buildGun } from '../game/render/models';
import { uiScale } from '../ui/ui';

const MAX_PIXEL_RATIO = 3;
/** One full turn every this many seconds while idle. */
const TURN_SECONDS = 6;
/** After dragging, the automatic turn waits this long. */
const IDLE_AFTER_DRAG_MS = 1500;
const DRAG_SPEED = 0.012;
const MAX_DT = 0.05;
const GUN_SCALE = 1.3;
const AIM_TILT = 0.12;

interface View {
  holder: THREE.Group;
  angle: number;
  drag: number | null;
  idle: number;
  raf: number;
}

// 3D character turning on the CSS pedestal. It can be turned by dragging.
export default function CharacterPreview({
  charId,
  skin,
  color,
}: {
  charId: CharacterId;
  skin: string;
  color: string;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * uiScale(), MAX_PIXEL_RATIO));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x6a5f4a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(2, 5, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fd4ff, 1.2);
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    // Only the shadow: the pedestal is a CSS oval in the class colour
    const base = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    scene.add(base);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.35, 4.6);
    camera.lookAt(0, 1.0, 0);

    const holder = new THREE.Group();
    scene.add(holder);
    const v: View = { holder, angle: 0.5, drag: null, idle: 0, raf: 0 };
    view.current = v;

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const down = (e: PointerEvent) => {
      v.drag = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (v.drag === null) return;
      v.angle += (e.clientX - v.drag) * DRAG_SPEED;
      v.drag = e.clientX;
      v.idle = performance.now();
    };
    const up = () => {
      v.drag = null;
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    let last = performance.now();
    const loop = (now: number) => {
      v.raf = requestAnimationFrame(loop);
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      if (v.drag === null && now - v.idle > IDLE_AFTER_DRAG_MS) v.angle += dt * ((Math.PI * 2) / TURN_SECONDS);
      holder.rotation.y = Math.PI + v.angle;
      renderer.render(scene, camera);
    };
    v.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(v.raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Changing character, skin or colour rebuilds the model
  useEffect(() => {
    const v = view.current;
    const ch = CHAR_BY_ID[charId];
    if (!v) return;
    v.holder.clear();
    const model = buildCharacter(ch.id, skin, color);
    model.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    const gun = buildGun(ch.primary, false, color);
    gun.scale.setScalar(GUN_SCALE);
    model.holdGun(gun);
    model.aim.rotation.x = AIM_TILT;
    v.holder.add(model.group);
  }, [charId, skin, color]);

  return <div className="char-stage-3d" ref={mount} />;
}
