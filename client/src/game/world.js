import * as THREE from 'three';

const TILE = 2; // metros por casilla de la textura

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = 235 + Math.random() * 20;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 4;
  g.strokeRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Caja con UVs escaladas al tamaño real: la cuadrícula siempre mide lo mismo
function tiledBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / TILE, (uv.getY(i) * dims[f][1]) / TILE);
    }
  }
  return geo;
}

export function buildWorld(scene, map) {
  const H = map.half;
  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.Fog(map.sky, H * 1.75, H * 4.25);

  scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x8a7f6a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(30, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -H - 8, right: H + 8, top: H + 8, bottom: -H - 8, near: 1, far: H * 4 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const tex = gridTexture();
  const mats = {};
  for (const [k, color] of Object.entries(map.colors)) {
    mats[k] = new THREE.MeshLambertMaterial({ color, map: tex });
  }
  for (const b of map.boxes) {
    const mesh = new THREE.Mesh(tiledBox(b.w, b.h, b.d), mats[b.c] || mats.wall);
    mesh.position.set(b.x, b.y + b.h / 2, b.z);
    mesh.castShadow = b.c !== 'floor';
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
