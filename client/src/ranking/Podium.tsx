// The top three on a 3D podium, each as their favourite character in their colour, under studio light.
// Renders only while on screen and frees its WebGL context on unmount (school laptops keep few alive).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHAR_BY_ID, type RankingRow } from '@blockshot/shared';
import { loadGun } from '../game/render/gunAssets';
import { buildCharacter, type CharacterModel } from '../game/render/models';
import { pc, rowColor } from './RankingTable';

const ACCENT = 0xff7a1a;
/** Steps left to right: [place (0 = 1st), x, height] */
const STEPS = [
  [1, -1.35, 0.42],
  [0, 0, 0.7],
  [2, 1.35, 0.26],
] as const;
const FOV = 28;
const CAM_Z = 9.6;
/** Half the width the three steps need on screen (m) */
const HALF_WIDTH = 2.3;
const GUN_SCALE = 1.3;

export default function Podium({ top }: { top: RankingRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // Rebuild only when someone on the podium (or their look) changes
  const key = top.map((r) => `${r.name}|${r.fav}|${r.favColor}`).join(',');

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return undefined;
    // A fresh canvas each time: a canvas whose context was let go cannot be used again
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const canvas = renderer.domElement;
    canvas.id = 'podium'; // the proposal's stylesheet places it by id
    stage.prepend(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2724, 0.55));
    const keyLight = new THREE.DirectionalLight(0xfff3e6, 1.4);
    keyLight.position.set(2, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 4;
    Object.assign(keyLight.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1 });
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0xffad72, 1.2);
    rim.position.set(-2, 3, -3);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);

    const stepMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.8 });
    const figures: CharacterModel[] = [];
    let alive = true;
    for (const [place, x, h] of STEPS) {
      const r = top[place];
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.25, h, 1.1), stepMat);
      step.position.set(x, h / 2, 0);
      step.receiveShadow = step.castShadow = true;
      scene.add(step);
      // Coloured band on the front edge (orange for the winner, dim when the place is free)
      const band = place === 0 ? ACCENT : r ? rowColor(r) : 0x2f3540;
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(1.26, 0.07, 0.02),
        new THREE.MeshBasicMaterial({ color: band }),
      );
      edge.position.set(x, h - 0.035, 0.56);
      scene.add(edge);
      if (!r) continue;
      const ch = CHAR_BY_ID[r.fav ?? 'soldado'];
      const color = rowColor(r);
      const m = buildCharacter(ch.id, 'base', color);
      m.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      m.group.position.set(x, h, 0);
      m.group.rotation.y = Math.PI - x * 0.18; // turned a little towards the centre
      m.aim.rotation.x = 0.12;
      scene.add(m.group);
      figures.push(m);
      void loadGun(ch.primary, { color }).then((g) => {
        if (!alive) return;
        g.scale.setScalar(GUN_SCALE);
        m.holdGun(g);
      });
    }

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Back off on narrow canvases so the three steps always fit
      const fit = HALF_WIDTH / (Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * camera.aspect);
      camera.position.set(0, 1.7, Math.max(CAM_Z, fit));
      camera.lookAt(0, 0.95, 0);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const clock = new THREE.Clock();
    const frame = () => {
      const t = clock.getElapsedTime();
      // Idle breathing so they don't look like statues
      figures.forEach((m, k) => (m.upper.position.y = Math.sin(t * 1.6 + k) * 0.008));
      renderer.render(scene, camera);
    };
    // Draw only while the canvas is on screen (another lobby tab hides it)
    const io = new IntersectionObserver(([e]) => renderer.setAnimationLoop(e?.isIntersecting ? frame : null));
    io.observe(canvas);

    return () => {
      alive = false;
      io.disconnect();
      ro.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        for (const m of [o.material].flat()) m.dispose();
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // free the WebGL context now: Chrome keeps only ~16 alive
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `top`
  }, [key]);

  return (
    <div className="stage3d" ref={ref}>
      <div className="plates">
        {STEPS.map(([place]) => {
          const r = top[place];
          return (
            <div key={place} className={`plate p${place + 1}`} style={pc(r ? rowColor(r) : 'var(--line)')}>
              <em>{place + 1}</em>
              <b>{r ? r.name : 'Libre'}</b>
              <span>
                {r
                  ? `${r.wins} ${r.wins === 1 ? 'victoria' : 'victorias'} · ${CHAR_BY_ID[r.fav ?? 'soldado'].name}`
                  : 'Puesto sin ocupar'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
