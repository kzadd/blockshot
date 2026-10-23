import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CHAR_BY_ID } from '@blockshot/shared';
import { buildCharacter, buildGun } from '../game/models.js';

// Personaje en 3D girando (una vuelta cada 6 s) sobre la peana de CSS. Se puede girar arrastrando.
export default function CharacterPreview({ charId, skin }) {
  const mount = useRef(null);
  const view = useRef(null);

  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const uiScale = Number(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * uiScale, 3));
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

    // Solo la sombra: la peana es un óvalo de CSS del color de la clase
    const base = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    scene.add(base);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.35, 4.6);
    camera.lookAt(0, 1.0, 0);

    const holder = new THREE.Group();
    scene.add(holder);
    const v = { renderer, scene, camera, holder, angle: 0.5, drag: null, idle: 0, raf: 0 };
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

    const down = (e) => {
      v.drag = e.clientX;
    };
    const move = (e) => {
      if (v.drag === null) return;
      v.angle += (e.clientX - v.drag) * 0.012;
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
    const loop = (now) => {
      v.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (v.drag === null && now - v.idle > 1500) v.angle += dt * ((Math.PI * 2) / 6);
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

  // Cambiar de personaje o skin: se reconstruye el modelo
  useEffect(() => {
    const v = view.current;
    const ch = CHAR_BY_ID[charId];
    if (!v || !ch) return;
    v.holder.clear();
    const model = buildCharacter(ch.id, skin, ch.color);
    model.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const gun = buildGun(ch.primary, false, ch.color);
    gun.scale.setScalar(1.3);
    model.hand.add(gun);
    model.aim.rotation.x = 0.12;
    v.holder.add(model.group);
  }, [charId, skin]);

  return <div className="char-stage-3d" ref={mount} />;
}
