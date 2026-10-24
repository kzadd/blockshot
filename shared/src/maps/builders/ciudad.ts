import { BARREL, LAMP, TREE, car, pad, sandbags, stairs } from '../props';
import type { MapBuildContext, StructureKind } from '../types';

// Ciudad: city blocks with streets, alleys, squares and some rooftops with stairs
export function buildCiudad({ B, S, P, H, rand }: MapBuildContext): void {
  const n = H < 34 ? 3 : H < 50 ? 4 : 5; // blocks per side
  const sw = 7; // street width
  const bs = (2 * H - (n + 1) * sw) / n; // block side
  const at = (i: number) => -H + sw + bs / 2 + i * (bs + sw); // centre of block i
  const street = (i: number) => -H + sw / 2 + i * (bs + sw); // centre of street i
  const cols: StructureKind[] = ['bld1', 'bld2', 'bld3', 'bld4'];
  const pickColor = () => cols[Math.floor(rand() * cols.length)]!;
  const plaza = Math.floor((n - 1) / 2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = at(i);
      const cz = at(j);
      const c = pickColor();
      const roll = rand();
      if ((i === plaza && j === plaza) || roll < 0.1) {
        // Square: fountain, trees and benches
        B(cx, 0, cz, 3, 0.8, 3, 'platform');
        for (const [dx, dz] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as const)
          P(cx + dx * (bs / 2 - 1.5), cz + dz * (bs / 2 - 1.5), TREE);
        P(cx, cz + bs / 2 - 1, sandbags(2.4, 0.6));
        continue;
      }
      const h = 4 + Math.floor(rand() * 4) * 2.5;
      if (roll < 0.28) {
        // Low building with stairs to the roof
        B(cx + 1.25, 0, cz, bs - 2.5, 3.5, bs, c);
        stairs(B, cx - bs / 2 + 1.25, cz + bs / 2 - 0.5, 'z', 1, 7, 2.5);
      } else if (roll < 0.6) {
        // Two buildings with an alley between them
        const w = (bs - 2.6) / 2;
        const h2 = 4 + Math.floor(rand() * 4) * 2.5;
        if (rand() < 0.5) {
          B(cx - (w + 2.6) / 2, 0, cz, w, h, bs, c);
          B(cx + (w + 2.6) / 2, 0, cz, w, h2, bs, pickColor());
        } else {
          B(cx, 0, cz - (w + 2.6) / 2, bs, h, w, c);
          B(cx, 0, cz + (w + 2.6) / 2, bs, h2, w, pickColor());
        }
      } else B(cx, 0, cz, bs, h, bs, c);
    }
  }
  // Jump pads in the middle of some streets: up to the low rooftops
  for (let i = 1; i < n; i++) {
    pad(B, street(i), at(i - 1));
    pad(B, at(n - i), street(i));
  }
  // Parked cars, lamps and barrels on the streets
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j < n; j++) {
      const side = rand() < 0.5 ? 1 : -1;
      if (rand() < 0.55) P(at(j) + (rand() - 0.5) * bs * 0.5, street(i) + side * 2.2, car(true));
      if (rand() < 0.55) P(street(i) + side * 2.2, at(j) + (rand() - 0.5) * bs * 0.5, car(false));
      if (rand() < 0.3) P(at(j) + bs / 2 - 0.6, street(i) - side * 2.8, BARREL);
    }
    for (let j = 0; j <= n; j++) {
      if (rand() < 0.5) P(street(i) + sw / 2 - 0.4, street(j) + sw / 2 - 0.4, LAMP);
      S(street(i), street(j));
    }
  }
}
