import { BARREL, PALLET, pad, stairs } from '../props';
import type { MapBuildContext, StructureKind } from '../types';

// Almacén: rows of containers, narrow aisles and mezzanines
export function buildAlmacen({ B, S, P, H, rand }: MapBuildContext): void {
  const mL = Math.round(0.55 * H);
  for (const s of [1, -1]) {
    // Mezzanine against the north/south wall, with railing and stairs at both ends
    B(0, 0, s * (H - 2.5), 2 * mL, 3.5, 5, 'platform');
    B(-(mL + 2) / 2, 3.5, s * (H - 4.85), mL - 4, 1, 0.3, 'rail');
    B((mL + 2) / 2, 3.5, s * (H - 4.85), mL - 4, 1, 0.3, 'rail');
    for (const t of [1, -1]) stairs(B, t * mL, s * (H - 2.5), 'x', -t, 7, 5);
  }

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
        // Crate next to it to climb up
        if (rand() < 0.4) B(sx * (x + 2.2), 0, z + (rand() < 0.5 ? 2 : -2), 1.8, 1.2, 1.8, 'crate');
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
      P(s * (H - 1.2), z, BARREL);
      P(s * (H - 1.2), z + 1, BARREL);
      P(s * (H - 2.2), z + 0.5, BARREL);
    }
  }
  for (let i = 0; i < Math.round(H / 4); i++) {
    const x = (rand() * 2 - 1) * (H - 6);
    const z = (rand() * 2 - 1) * (H - 9);
    P(x, z, rand() < 0.5 ? PALLET : BARREL);
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
