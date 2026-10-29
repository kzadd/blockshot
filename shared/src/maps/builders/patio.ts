import { BARREL, LAMP, TREE, pad, sandbags, stairs } from '../props';
import { PARAPET_H, ROOF_T, STORY, house, mirrorHouse } from '../structures';
import type { MapBuildContext } from '../types';

// Patio: central tower, middle walls and rooms in the corners
export function buildPatio(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL } = ctx;
  const k = H / 40;
  B(0, 0, 0, 12, 3, 12, 'platform');
  for (const s of [1, -1]) {
    stairs(B, 0, s * 6, 'z', -s, 5, 4);
    // Crates to jump up from east and west
    B(s * 8.5, 0, 0, 3, 1.2, 3, 'crate');
    B(s * 6.75, 0, 0, 1.5, 2.2, 3, 'crate');
  }
  B(-3.5, 3, -3.5, 2, 1.2, 2, 'crate2');
  B(3.5, 3, 3.5, 2, 1.2, 2, 'crate2');
  // Jump pads next to the stairs: straight up to the tower
  for (const sx of [1, -1]) for (const sz of [1, -1]) pad(B, sx * 4.6, sz * 9);

  // Middle walls with a gap in the centre (second ring on the large size)
  const rings = [Math.max(13, 0.45 * H)];
  if (H >= 50) rings.push(0.75 * H);
  for (const d of rings) {
    for (const s of [1, -1]) {
      B(s * d, 0, -7, 1, 4, 8, 'wall2');
      B(s * d, 0, 7, 1, 4, 8, 'wall2');
      B(-7, 0, s * d, 8, 4, 1, 'wall2');
      B(7, 0, s * d, 8, 4, 1, 'wall2');
    }
  }

  // Corner town houses: two floors and a roof terrace, doors towards the square and the back alley
  const c = 0.55 * H;
  const hw = H < 30 ? 9.6 : H < 50 ? 11 : 13;
  const hc = c + hw / 2;
  const alley = (c + hw + H) / 2;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const brick = sx * sz > 0;
      house(
        ctx,
        mirrorHouse(
          {
            x: sx * hc,
            z: sz * hc,
            w: hw,
            d: hw,
            stories: 2,
            wall: brick ? 'brick' : 'plaster',
            shutter: brick ? undefined : 'shutter',
            frame: brick ? 'trim' : 'frame',
            awning: 'awning',
            ground: 'tile',
            doors: [
              { side: 'w', at: -hw / 2 + 2.2 },
              { side: 'n', at: -hw / 2 + 2.2 },
              { side: 'e', at: -hw / 2 + 2.2 },
            ],
            windows: [
              { side: 'w', at: hw / 2 - 2.6 },
              { side: 'n', at: hw / 2 - 2.6 },
              { side: 'e', at: hw / 2 - 2.6 },
              { side: 'w', at: -hw / 2 + 2, story: 1 },
              { side: 'w', at: hw / 2 - 1.6, story: 1 },
              { side: 'n', at: hw / 2 - 2, story: 1 },
              { side: 'e', at: 0, story: 1 },
              { side: 's', at: -hw / 2 + 2, story: 1 },
              { side: 's', at: hw / 2 - 2, story: 1 },
            ],
            stairs: [
              { side: 's', at: hw / 2 - 1.3, dir: -1 },
              { side: 'n', at: -hw / 2 + 1, dir: 1, story: 1 },
            ],
            balconies: [{ side: 'w', at: 0.4, w: 3 }],
          },
          sx,
          sz,
        ),
      );
      // Some furniture to hide behind: a crate downstairs, a stack upstairs
      B(sx * (hc + 0.8), 0, sz * (hc - 0.6), 1.4, 1.1, 1.4, 'crate');
      B(sx * (hc + hw / 2 - 1.6), STORY, sz * (hc - 0.4), 1.4, 1.2, 1.4, 'crate2');
    }
  }

  const crates = [
    [-10, -28],
    [10, 28],
    [-28, 10],
    [28, -10],
    [-12, -12],
    [12, 12],
  ] as const;
  for (const [x, z] of crates) B(x * k, 0, z * k, 2.4, 1.2, 2.4, 'crate');
  // The four crates on the cross axes break
  for (const [x, z] of [
    [0, -26],
    [0, 26],
    [-26, 0],
    [26, 0],
  ] as const)
    BK(x * k, z * k, 1.6);
  // Crate stacks (climbable by jumping)
  B(-12 * k, 0, 12 * k, 2.4, 2.4, 2.4, 'crate2');
  B(-12 * k - 2.4, 0, 12 * k, 2.4, 1.2, 2.4, 'crate');
  B(12 * k, 0, -12 * k, 2.4, 2.4, 2.4, 'crate2');
  B(12 * k + 2.4, 0, -12 * k, 2.4, 1.2, 2.4, 'crate');
  if (H >= 50) {
    for (const [x, z] of [
      [-0.6, -0.3],
      [0.6, 0.3],
      [0.3, -0.6],
      [-0.3, 0.6],
    ] as const) {
      B(x * H, 0, z * H, 2.4, 2.4, 2.4, 'crate2');
      B(x * H + 2.4 * Math.sign(x), 0, z * H, 2.4, 1.2, 2.4, 'crate');
    }
  }

  // Trees in planters, lamps by the tower, barrels and sandbags
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      P(sx * 0.62 * H, sz * 0.3 * H, TREE);
      P(sx * 0.3 * H, sz * 0.62 * H, TREE);
      P(sx * 7.6, sz * 7.6, LAMP);
    }
  }
  const d0 = rings[0]!;
  for (const s of [1, -1]) {
    for (const z of [0.3 * H, -0.3 * H]) {
      P(s * (H - 1.2), z, BARREL);
      P(s * (H - 1.2), z + 1, BARREL);
      P(s * (H - 2.2), z + 0.5, BARREL);
    }
    P(s * (d0 + 3), 0, sandbags(1, 3));
    P(0, s * (d0 + 3), sandbags(3, 1));
  }

  // Market stalls in the square (counter, posts and a striped awning: cover to advance from) and two fountains
  // behind the gaps of the middle walls, so the square is no longer crossed in one run
  const stall = (x: number, z: number, alongX: boolean) => {
    const [w, d] = alongX ? [3.2, 2.2] : [2.2, 3.2];
    B(x, 0, z, alongX ? 3 : 0.8, 1.1, alongX ? 0.8 : 3, 'wood');
    for (const px of [-1, 1])
      for (const pz of [-1, 1]) B(x + (px * w) / 2, 0, z + (pz * d) / 2, 0.15, 2.6, 0.15, 'wood');
    D(x, 2.6, z, w + 0.4, 0.15, d + 0.4, 'awning');
  };
  for (const s of [1, -1]) {
    stall(-s * 7 * k, -s * 23 * k, true);
    stall(s * 23 * k, -s * 7 * k, false);
    B(0, 0, s * 21.5 * k, 4, 0.8, 4, 'concrete');
    B(0, 0.8, s * 21.5 * k, 0.8, 1.6, 0.8, 'concrete');
    D(0, 0.8, s * 21.5 * k, 3.4, 0.02, 3.4, 'water');
    // Barrels inside the middle walls
    BR(s * (d0 - 1.5), s * 4);
  }

  // Up high: armour on the tower; ziplines from two of the house roofs down to it; ladders up the other two
  // (to above the parapet, so the climber steps over it)
  PK('armor', 0, 0);
  const roofTop = 2 * STORY + ROOF_T;
  for (const s of [1, -1]) {
    // From the roof corner nearest the tower, high enough to clear the parapet (jump to grab it)
    ZL([s * (c + 0.5), roofTop + PARAPET_H + 2.3, s * (c + 0.5)], [s * 4.5, 3 + 2.3, s * 1]);
    LD(-s * (hc + hw / 2), s * (hc - 1.5), roofTop + PARAPET_H, s > 0 ? 1 : 3);
    // Health in the back alleys
    PK('hp', s * 36 * k, -s * 8 * k);
  }

  // Corner spawns in the back alleys (no further west than the west spawn, which holds the CTF base)
  for (const sx of [1, -1]) for (const sz of [1, -1]) S(sx * 34 * k, sz * alley);
  const spawns = [
    [0, -34],
    [0, 34],
    [-34, 0],
    [34, 0],
    [20, 30],
    [-20, -30],
    [30, -14],
    [-30, 14],
  ] as const;
  for (const [x, z] of spawns) S(x * k, z * k);
}
