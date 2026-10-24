// Surface normals for impact effects. Every map collider is an axis-aligned box, so the normal at a hit
// point is the axis of the box face the point lies on.
import * as THREE from 'three';
import type { Collider } from '@blockshot/shared';

/** How far (m) a point may be from a face and still count as lying on it. */
const ON_SURFACE = 0.03;

/**
 * Normal of the wall/prop face that `p` lies on, or null if `p` is not on any collider (a player or the
 * end of the range).
 */
export function wallNormal(
  p: THREE.Vector3,
  colliders: readonly Pick<Collider, 'min' | 'max'>[],
  out = new THREE.Vector3(),
): THREE.Vector3 | null {
  let best = ON_SURFACE;
  let found = false;
  const pt = [p.x, p.y, p.z] as const;
  for (const b of colliders) {
    let inside = true;
    for (let i = 0; i < 3 && inside; i++) inside = pt[i]! >= b.min[i]! - ON_SURFACE && pt[i]! <= b.max[i]! + ON_SURFACE;
    if (!inside) continue;
    for (let i = 0; i < 3; i++) {
      const toMin = Math.abs(pt[i]! - b.min[i]!);
      const toMax = Math.abs(pt[i]! - b.max[i]!);
      const d = Math.min(toMin, toMax);
      if (d <= best) {
        best = d;
        found = true;
        out.set(0, 0, 0).setComponent(i, toMin < toMax ? -1 : 1);
      }
    }
  }
  return found ? out : null;
}
