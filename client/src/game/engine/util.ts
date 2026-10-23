import * as THREE from 'three';

export const damp = (k: number, dt: number): number => 1 - Math.exp(-k * dt);

/** Moves angle `a` towards `b` by fraction `k` along the shortest way round. */
export function dampAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A random direction inside a cone of `spread` radians around `base` (uniform over the disc). */
export function spreadDir(base: THREE.Vector3, spread: number): THREE.Vector3 {
  if (spread <= 0) return base.clone();
  const r = spread * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  const right = new THREE.Vector3().crossVectors(base, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, base).normalize();
  return base
    .clone()
    .addScaledVector(right, Math.cos(a) * r)
    .addScaledVector(up, Math.sin(a) * r)
    .normalize();
}

/** Screen angle (0 = ahead, positive = right) of a world point seen from (x, z) looking along `yaw`. */
export const screenAngle = (fromX: number, fromZ: number, yaw: number, x: number, z: number): number =>
  -(Math.atan2(-(x - fromX), -(z - fromZ)) - yaw);
