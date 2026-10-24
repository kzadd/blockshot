import { BARREL, PALLET, pad, stairs } from '../props';
import { STORY, house, railing, type HouseSpec } from '../structures';
import type { MapBuildContext, StructureKind } from '../types';

/** Depth of the mezzanine offices against the north and south walls (m). */
const MEZZ_D = 5;
/** Target width of each mezzanine office room (m). */
const ROOM_W = 8;
/** Side offices against the east and west walls: footprint (m). */
const OFFICE_W = 6;
const OFFICE_D = 10;
/** Gap left in the mezzanine railing so the jump pad below can land you on the walkway (m). */
const PAD_GAP = 4;

// Almacén: rows of containers, narrow aisles, offices under the mezzanines and two-story side offices
export function buildAlmacen(ctx: MapBuildContext): void {
  const { B, S, P, H, rand } = ctx;
  const mL = Math.round(0.55 * H);
  const offices: HouseSpec[] = [];
  for (const s of [1, -1]) {
    // Offices under the mezzanine: a row of rooms with doors and windows towards the containers.
    // Their roof is the walkway, with a railing and stairs at both ends
    const rooms = Math.max(2, Math.round((2 * mL) / ROOM_W));
    const roomW = (2 * mL) / rooms;
    const front = s > 0 ? 'n' : 's';
    const centres = Array.from({ length: rooms }, (_, i) => -mL + (i + 0.5) * roomW);
    house(ctx, {
      x: 0,
      z: s * (H - MEZZ_D / 2),
      w: 2 * mL,
      d: MEZZ_D,
      wall: 'metal',
      roof: 'platform',
      ground: 'tile',
      parapet: false,
      doors: centres.map((c, i) => ({ side: front, at: c + (i % 2 ? 1.6 : -1.6) })),
      windows: centres.map((c, i) => ({ side: front, at: c + (i % 2 ? -1.4 : 1.4), w: 2.2 })),
      partitions: centres.slice(1).map((c) => ({ run: 'z' as const, at: c - roomW / 2, door: 0 })),
    });
    const railZ = s * (H - MEZZ_D + 0.06);
    railing(B, -mL, railZ, -PAD_GAP / 2, railZ, STORY);
    railing(B, PAD_GAP / 2, railZ, mL, railZ, STORY);
    for (const t of [1, -1]) stairs(B, t * mL, s * (H - MEZZ_D / 2), 'x', -t, STORY / 0.5, MEZZ_D);

    // Two-story office against the east (s = 1) or west wall, with stairs to the roof
    const office: HouseSpec = {
      x: s * (H - OFFICE_W / 2),
      z: s * 0.3 * H,
      w: OFFICE_W,
      d: OFFICE_D,
      stories: 2,
      wall: 'metal',
      ground: 'tile',
      doors: [
        { side: s > 0 ? 'w' : 'e', at: -2.5 },
        { side: 'n', at: -0.6 * s },
        { side: 's', at: -0.6 * s },
      ],
      windows: [
        { side: s > 0 ? 'w' : 'e', at: 2 },
        { side: s > 0 ? 'w' : 'e', at: -2.5, story: 1 },
        { side: s > 0 ? 'w' : 'e', at: 2, story: 1, w: 2 },
        { side: 'n', at: -0.6 * s, story: 1 },
        { side: 's', at: -0.6 * s, story: 1 },
      ],
      stairs: [
        { side: s > 0 ? 'e' : 'w', at: 4, dir: -1 },
        { side: s > 0 ? 'e' : 'w', at: -0.6, dir: -1, story: 1 },
      ],
    };
    house(ctx, office);
    offices.push(office);
    B(office.x + s * 0.4, 0, office.z + 2.5, 1.2, 1.2, 1.2, 'crate');
    B(office.x - s * 1.2, STORY, office.z + 3.4, 1.4, 1.1, 1.4, 'crate2');
  }
  const inOffice = (x: number, z: number, margin: number) =>
    offices.some((o) => Math.abs(x - o.x) < o.w / 2 + margin && Math.abs(z - o.z) < o.d / 2 + margin);

  // Containers in columns; the centre stays free
  const zMax = H - 9;
  const rows = Math.floor((2 * zMax + 4) / 10);
  const colors: StructureKind[] = ['cont1', 'cont2', 'cont3'];
  const color = () => colors[Math.floor(rand() * 3)]!;
  for (let x = 6; x + 1.3 < H - 3.5; x += 8) {
    for (const sx of [1, -1]) {
      for (let r = 0; r < rows; r++) {
        const z = (r - (rows - 1) / 2) * 10;
        if (x < 8 && Math.abs(z) < 7) continue;
        const roll = rand();
        if (roll < 0.12) continue; // gap to cross
        B(sx * x, 0, z, 2.6, 2.6, 6, color());
        if (roll < 0.35) B(sx * x, 2.6, z, 2.6, 2.6, 6, color());
        // Crate next to it to climb up (not in front of the side offices)
        if (rand() < 0.4) {
          const cz = z + (rand() < 0.5 ? 2 : -2);
          if (!inOffice(sx * (x + 2.2), cz, 1.8)) B(sx * (x + 2.2), 0, cz, 1.8, 1.2, 1.8, 'crate');
        }
      }
    }
  }
  // Centre: crates to fight around and climb
  B(-2, 0, -1.6, 2.4, 1.2, 2.4, 'crate');
  B(2, 0, 1.6, 2.4, 2.4, 2.4, 'crate2');
  B(4.4, 0, 1.6, 2.4, 1.2, 2.4, 'crate');
  // Jump pads: on top of the containers and up to the mezzanines
  for (const s of [1, -1]) {
    pad(B, 0, s * 5);
    pad(B, 0, s * (H - 7.5));
  }

  // Barrels by the walls and pallets with crates along the aisles
  for (const s of [1, -1]) {
    for (const z of [0.3 * H, -0.3 * H]) {
      if (inOffice(s * (H - 1.2), z, 1)) continue;
      P(s * (H - 1.2), z, BARREL);
      P(s * (H - 1.2), z + 1, BARREL);
      P(s * (H - 2.2), z + 0.5, BARREL);
    }
  }
  for (let i = 0; i < Math.round(H / 4); i++) {
    const x = (rand() * 2 - 1) * (H - 6);
    const z = (rand() * 2 - 1) * (H - 9);
    const prop = rand() < 0.5 ? PALLET : BARREL;
    if (!inOffice(x, z, 1)) P(x, z, prop);
  }
  P(-4.6, 2.8, PALLET);
  P(-0.2, -4.2, BARREL);

  for (const z of [-0.6, 0, 0.6]) {
    S(H - 1.8, z * H);
    S(-(H - 1.8), z * H);
  }
  for (const s of [1, -1]) {
    S(0, s * (H - 2.5));
    S(s * (H - 2), H - 2);
    S(s * (H - 2), -(H - 2));
  }
}
