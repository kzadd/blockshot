import { BARREL, PALLET, pad, sandbags } from '../props';
import { RAIL_H, RAIL_T, STAIR_W, STEP_RUN, STORY, flight, house, railing, slab, type Rect } from '../structures';
import type { BoxFn, MapBuildContext } from '../types';

/** Floors of the concrete skeleton in the middle; the last one is its open roof (m = LEVELS × STORY). */
const LEVELS = 3;
const DECK_T = 0.3;
const COLUMN = 0.8;
/** Gap left in the middle of every edge railing: jump down, or land there from a pad or a scaffold. */
const EDGE_GAP = 4;
/** Stairs of the skeleton: two bands side by side along its north edge, one flight per story (switchback). */
const STAIR_X0 = -3;
const STEPS = STORY / 0.5;
/** Extra hole round each flight so a player on the stairs never bumps the floor above. */
const WELL_MARGIN = 0.4;
/** Scaffolds north and south of the skeleton: length along x, depth, posts every few metres. */
const SCAF_D = 2.4;
const SCAF_POSTS = 3.4;
const POST = 0.15;
const PLANK_T = 0.15;
/** Half-built brick walls: low enough to shoot over crouching. */
const LOW_WALL_H = 1.3;
const CONT = { w: 2.6, h: 2.6, d: 6 };
/** Half sides above which the open ground gets extra cover (the small map is cramped enough). */
const SMALL_SITE = 30;
const MEDIUM_SITE = 45;
/** Tower crane by the north wall: the mast collides, the jib and the hanging load are decoration. */
const CRANE_MAST = 1.6;
const CRANE_H = 22;
/** Landing on the crane's mast, reached by a ladder: the zipline down to the skeleton starts there. */
const CRANE_LANDING = 14;

// Obra: an open concrete skeleton of three floors in the middle, scaffolds, site huts and a tower crane.
// Mirror-symmetric on x so Red (west) and Blue (east) start the same.
export function buildObra(ctx: MapBuildContext): void {
  const { B, D, S, P, H, BR, BK, PK, LD, ZL, rand } = ctx;
  const t = Math.round(Math.min(12, Math.max(7, 0.24 * H))); // half side of the skeleton

  skeleton(B, t);
  for (const s of [1, -1]) {
    pad(B, s * (t + 2.5), 0);
    pad(B, s * (t + 2.5), 0.45 * t);
  }

  // Scaffolds north and south: two plank decks with railings, stairs at one end up to the first deck and at
  // the other up to the second. From the top deck you can jump onto the skeleton's second floor
  const sw = Math.min(2 * t - 2, 14);
  const sz = Math.min(t + 5, H - 6);
  // Rotated copies (north climbs from the west, south from the east), so both teams get the same routes
  for (const s of [1, -1]) scaffold(B, 0, s * sz, sw, s, s);

  // Site huts by the spawn walls, one stacked; sandbags in front of them
  for (const s of [1, -1]) {
    for (const z of [0.45 * H, -0.45 * H]) {
      const x = s * (H - 6);
      B(x, 0, z, CONT.w, CONT.h, CONT.d, z > 0 ? 'cont1' : 'cont2');
      if (z > 0) B(x, CONT.h, z, CONT.w, CONT.h, CONT.d, 'cont1');
      P(x - s * 3, z - Math.sign(z) * 2, sandbags(0.9, 3));
    }
  }

  // Half-built brick walls for cover in the open ground
  for (const s of [1, -1]) {
    B(s * 0.5 * H, 0, 0, 0.4, LOW_WALL_H, 5, 'brick');
    for (const z of [1, -1]) B(s * 0.62 * H, 0, z * 0.25 * H, 4, LOW_WALL_H, 0.4, 'brick');
    for (const z of [1, -1]) B(s * (t + 6), 0, z * (t + 1), 0.4, LOW_WALL_H, 3.2, 'brick');
  }
  // Crates of material near the skeleton (to climb on and to hide behind)
  for (const s of [1, -1]) {
    for (const z of [1, -1]) {
      B(s * (t + 1.6), 0, z * (t - 1.5), 1.6, 1.2, 1.6, 'crate');
      B(s * (t + 1.6), 1.2, z * (t - 1.5), 1.2, 1, 1.2, 'crate2');
    }
  }

  // Bigger sites get more cover in the open ground between the skeleton and the walls
  if (H > SMALL_SITE) {
    for (const s of [1, -1]) {
      for (const z of [1, -1]) {
        B(s * 0.72 * H, 0, z * 0.72 * H, CONT.d, CONT.h, CONT.w, 'cont2');
        B(s * 0.3 * H, 0, z * (t + 9), 4.5, LOW_WALL_H, 0.4, 'brick');
        B(s * (0.3 * H + 2.05), 0, z * (t + 10.4), 0.4, LOW_WALL_H, 2.4, 'brick');
        B(s * 0.82 * H, 0, z * 0.18 * H, 1.6, 1.2, 1.6, 'crate');
      }
    }
  }
  if (H > MEDIUM_SITE) {
    for (const s of [1, -1]) {
      for (const z of [1, -1]) {
        B(s * 0.5 * H, 0, z * 0.5 * H, CONT.w, CONT.h, CONT.d, 'cont1');
        B(s * 0.5 * H, CONT.h, z * 0.5 * H, CONT.w, CONT.h, CONT.d, 'cont2');
        B(s * 0.62 * H, 0, z * 0.9 * H, 0.4, LOW_WALL_H, 4, 'brick');
      }
    }
  }

  crane(B, D, H);
  // A landing on the crane's mast (a ladder up from the ground) and a zipline from it down onto the top floor
  const cz = -(H - 4);
  B(2.3, CRANE_LANDING, cz, 3, 0.3, 3, 'metal');
  LD(2.3, cz + 1.5, CRANE_LANDING + 0.3, 0);
  D(2.3, 0, cz + 1.75, 0.2, CRANE_LANDING, 0.2, 'metal');
  ZL([2.3, CRANE_LANDING + 0.3 + 2.3, cz + 1.6], [0, LEVELS * STORY + 2.3, -t + 2]);
  PK('armor', 0, 2, LEVELS * STORY);

  // Site huts with health, steel beams and pipes stacked on the open ground, fuel barrels, crates that break
  for (const s of [1, -1]) {
    const hx = s * 0.62 * H;
    const hz = s * 0.42 * H;
    // (the small site has no room for the huts: its scaffold stairs run there; the health lies in the open)
    if (H <= SMALL_SITE) PK('hp', s * 0.62 * H, -s * 0.6 * H);
    else
      house(ctx, {
        x: hx,
        z: hz,
        w: 7,
        d: 5,
        wall: 'metal',
        roof: 'roof',
        ground: 'tile',
        doors: [{ side: s > 0 ? 'w' : 'e' }, { side: s > 0 ? 'n' : 's' }],
        windows: [{ side: s > 0 ? 'e' : 'w' }],
      });
    if (H > SMALL_SITE) PK('hp', hx, hz);
    BR(hx + s * 2, hz + s * 4);
    const bx = -s * 0.35 * H;
    const bz = s * 0.75 * H;
    B(bx, 0, bz, 6, 0.5, 1.4, 'metal');
    B(bx, 0.5, bz, 6, 0.5, 1.4, 'metal');
    B(bx, 0, bz + 2.2, 5, 0.8, 0.8, 'concrete');
    BK(s * 0.4 * H, -s * 0.15 * H, 1.3);
  }

  // Pallets, barrels and sandbags scattered round the site (never under the skeleton nor the scaffolds)
  const busy = (x: number, z: number) =>
    (Math.abs(x) < t + 3 && Math.abs(z) < t + 3) || (Math.abs(x) < sw / 2 + 2 && Math.abs(Math.abs(z) - sz) < 3);
  for (let i = 0; i < Math.round(H / 3); i++) {
    const x = (rand() * 2 - 1) * (H - 4);
    const z = (rand() * 2 - 1) * (H - 4);
    if (busy(x, z)) continue;
    const roll = rand();
    // Mirrored so both halves get the same cover
    for (const m of [1, -1]) P(m * x, z, roll < 0.45 ? PALLET : roll < 0.8 ? BARREL : sandbags(2, 0.9));
  }

  for (const s of [1, -1]) {
    for (const z of [-0.6, 0, 0.6]) S(s * (H - 1.8), z * H);
    S(s * (H - 2), H - 2);
    S(s * (H - 2), -(H - 2));
  }
  S(0, H - 2.5);
}

// Open concrete skeleton: columns, a floor per story with stairwells, edge railings with a gap per side
function skeleton(B: BoxFn, t: number): void {
  const top = LEVELS * STORY;
  const span = 2 * t;
  const bays = Math.max(2, Math.round(span / 6));
  for (let i = 0; i <= bays; i++) {
    for (let j = 0; j <= bays; j++) {
      // The stair bands run along the north edge: no column in their way
      if (j === 0 && i > 0 && i < bays) continue;
      const x = -t + COLUMN / 2 + (i * (span - COLUMN)) / bays;
      const z = -t + COLUMN / 2 + (j * (span - COLUMN)) / bays;
      B(x, 0, z, COLUMN, top, COLUMN, 'concrete');
    }
  }

  // Switchback stairs: band 1 (outer) climbs east on even stories, band 2 climbs back west on odd ones
  const band1: [number, number] = [-t + 0.2, -t + 0.2 + STAIR_W];
  const band2: [number, number] = [band1[1], band1[1] + STAIR_W];
  const run = (STEPS - 1) * STEP_RUN + STEP_RUN;
  const x1 = STAIR_X0 + run;
  const holes = new Map<number, Rect>();
  for (let level = 0; level < LEVELS; level++) {
    const even = level % 2 === 0;
    const [c0, c1] = even ? band1 : band2;
    const start = even ? STAIR_X0 : x1;
    flight(B, 'x', start, even ? 1 : -1, c0, c1, level * STORY, STEPS);
    // Margin only behind the first step and on the open side: the top step meets the floor with no gap
    holes.set(level + 1, {
      x0: even ? STAIR_X0 - WELL_MARGIN : STAIR_X0,
      x1: even ? x1 : x1 + WELL_MARGIN,
      z0: c0,
      z1: c1 + (even ? 0 : WELL_MARGIN),
    });
  }

  const deck: Rect = { x0: -t, x1: t, z0: -t, z1: t };
  for (let level = 1; level <= LEVELS; level++) {
    const y = level * STORY;
    const hole = holes.get(level)!;
    slab(B, deck, y, DECK_T, 'slab', [hole]);
    // Railing along the open side of the stairwell
    railing(B, hole.x0, hole.z1 + RAIL_T / 2, hole.x1, hole.z1 + RAIL_T / 2, y);
    // Edge railings with a gap in the middle of every side
    const e = t - RAIL_T / 2;
    for (const s of [1, -1]) {
      railing(B, -t, s * e, -EDGE_GAP / 2, s * e, y);
      railing(B, EDGE_GAP / 2, s * e, t, s * e, y);
      railing(B, s * e, -t, s * e, -EDGE_GAP / 2, y);
      railing(B, s * e, EDGE_GAP / 2, s * e, t, y);
    }
    // Low concrete blocks on every floor to fight from
    for (const s of [1, -1]) B(s * t * 0.45, y, t * 0.35, 1.6, 1.1, 0.6, 'concrete');
  }
}

// Scaffold of two plank decks along x, centred at (x, z); `out` = the side facing away from the skeleton.
// Stairs run along x in line with the decks: one up to deck 1 at the `first` end (+1 = west), a longer one
// up to deck 2 at the other end, so each lands straight onto its deck
function scaffold(B: BoxFn, x: number, z: number, w: number, out: number, first: number): void {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - SCAF_D / 2;
  const z1 = z + SCAF_D / 2;
  const posts = Math.max(2, Math.round(w / SCAF_POSTS));
  for (let i = 0; i <= posts; i++) {
    const px = x0 + POST / 2 + (i * (w - POST)) / posts;
    for (const pz of [z0 + POST / 2, z1 - POST / 2]) B(px, 0, pz, POST, 2 * STORY + RAIL_H, POST, 'metal');
  }
  for (const level of [1, 2]) {
    const y = level * STORY;
    B(x, y - PLANK_T, z, w, PLANK_T, SCAF_D, 'platform');
    const edge = SCAF_D / 2 - RAIL_T / 2;
    railing(B, x0, z + out * edge, x1, z + out * edge, y);
    // The front (towards the skeleton) stays open on the top deck: that is the jump
    if (level === 1) railing(B, x0, z - out * edge, x1, z - out * edge, y);
  }
  const lo = first > 0 ? x0 : x1; // end reached from deck 1's stairs
  const hi = first > 0 ? x1 : x0;
  flight(B, 'x', lo - first * STEPS * STEP_RUN, first > 0 ? 1 : -1, z0, z1, 0, STEPS);
  flight(B, 'x', hi + first * 2 * STEPS * STEP_RUN, first > 0 ? -1 : 1, z0, z1, 0, 2 * STEPS);
}

// Tower crane by the north wall: a mast you can hide behind, a jib over the site and its counterweight
function crane(B: BoxFn, D: BoxFn, H: number): void {
  const z = -(H - 4);
  B(0, 0, z, CRANE_MAST, CRANE_H, CRANE_MAST, 'rail');
  D(0, CRANE_H, z, 2.4, 2, 2.4, 'metal'); // cab
  D(0.4 * H, CRANE_H + 1.2, z, 0.8 * H + 2.4, 1, 1, 'rail'); // jib
  D(-0.25 * H, CRANE_H + 1.2, z, 0.5 * H, 1, 1, 'rail'); // counter-jib
  D(-0.45 * H, CRANE_H - 0.6, z, 3, 2, 1.8, 'concrete'); // counterweight
  D(0, CRANE_H + 2, z, 0.5, 5, 0.5, 'rail'); // peak
  const hook = 0.55 * H;
  D(hook, CRANE_H - 8, z, 0.08, 8.6, 0.08, 'railing'); // cable
  D(hook, CRANE_H - 9.2, z, 2.2, 1.2, 2.2, 'crate'); // load
}
