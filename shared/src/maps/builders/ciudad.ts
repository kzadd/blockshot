import { BARREL, LAMP, TREE, car, pad, sandbags } from '../props';
import { STORY, house } from '../structures';
import type { MapBuildContext, StructureKind } from '../types';

/** Shop windows: wide and low. */
const SHOP_WINDOW = { w: 2.4, sill: 0.7, top: 2.2 };
/** Blocks at least this wide get a two-story walk-up (the outside stairs need the length). */
const WALKUP_MIN = 10;
/** Tall blocks (m) get a shop on the ground floor. */
const SHOP_MIN_H = 6.5;

// Ciudad: city blocks with streets, alleys and squares; walk-up houses with roof terraces and shops under the towers
export function buildCiudad(ctx: MapBuildContext): void {
  const { B, S, P, H, rand } = ctx;
  const n = H < 34 ? 3 : H < 50 ? 4 : 5; // blocks per side
  const sw = 7; // street width
  const bs = (2 * H - (n + 1) * sw) / n; // block side
  const at = (i: number) => -H + sw + bs / 2 + i * (bs + sw); // centre of block i
  const street = (i: number) => -H + sw / 2 + i * (bs + sw); // centre of street i
  const cols: StructureKind[] = ['bld1', 'bld2', 'bld3', 'bld4'];
  const pickColor = () => cols[Math.floor(rand() * cols.length)]!;
  const plaza = Math.floor((n - 1) / 2);
  // Walk-up house: shop downstairs, a flat upstairs (two stories) and outside stairs to the roof
  const walkUp = (cx: number, cz: number, stories: number, brick: boolean) => {
    const w = bs - 1.4;
    house(ctx, {
      x: cx + 0.7,
      z: cz,
      w,
      d: bs,
      stories,
      wall: brick ? 'brick' : 'plaster',
      ground: 'tile',
      awning: 'awning',
      frame: brick ? 'trim' : 'frame',
      doors: [
        { side: 'e', at: -0.2 * bs },
        { side: 'n', at: 0.15 * w },
        { side: 's', at: -0.15 * w },
      ],
      windows: [
        { side: 'e', at: 0.2 * bs, ...SHOP_WINDOW },
        { side: 'n', at: -0.25 * w, ...SHOP_WINDOW, w: 2 },
        { side: 's', at: 0.25 * w, ...SHOP_WINDOW, w: 2 },
        ...(stories > 1
          ? ([
              { side: 'e', at: -0.25 * bs, story: 1 },
              { side: 'e', at: 0.25 * bs, story: 1 },
              { side: 'n', at: 0, story: 1 },
              { side: 's', at: 0, story: 1 },
            ] as const)
          : []),
      ],
      stairs: stories > 1 ? [{ side: 'w', at: 0.35 * bs, dir: -1 }] : [],
      outside: { side: 'w', at: -bs / 2 + 0.1, dir: 1 },
    });
  };
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
        walkUp(cx, cz, bs >= WALKUP_MIN ? 2 : 1, (i + j) % 2 === 1);
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
      } else if (h >= SHOP_MIN_H) {
        // Tall block with a walk-through shop on the ground floor
        house(ctx, {
          x: cx,
          z: cz,
          w: bs,
          d: bs,
          wall: 'concrete',
          ground: 'tile',
          awning: 'awning',
          parapet: false,
          doors: [
            { side: 'n', at: -0.2 * bs },
            { side: 's', at: 0.2 * bs },
            { side: 'e', at: 0 },
          ],
          windows: [
            { side: 'n', at: 0.2 * bs, ...SHOP_WINDOW },
            { side: 's', at: -0.2 * bs, ...SHOP_WINDOW },
            { side: 'w', at: 0.2 * bs, ...SHOP_WINDOW },
            { side: 'w', at: -0.2 * bs, ...SHOP_WINDOW },
            { side: 'e', at: 0.3 * bs, ...SHOP_WINDOW, w: 2 },
            { side: 'e', at: -0.3 * bs, ...SHOP_WINDOW, w: 2 },
          ],
        });
        B(cx - 0.15 * bs, 0, cz, 1, 1.1, 0.35 * bs, 'crate'); // counter
        B(cx, STORY, cz, bs, h - STORY, bs, c);
      } else walkUp(cx, cz, 1, (i + j) % 2 === 0); // low block: one story with a roof terrace
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
