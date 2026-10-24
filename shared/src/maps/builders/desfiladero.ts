import { BARREL, CACTUS, pad, sandbags, stairs } from '../props';
import type { MapBuildContext } from '../types';

// Desfiladero: a canyon between two high mesas joined by bridges
export function buildDesfiladero({ B, S, P: Prop, H, rand }: MapBuildContext): void {
  const P = Math.max(10, Math.round(0.32 * H)); // the canyon spans -P..P
  const bridges = [0, 0.5 * H, -0.5 * H];
  for (const s of [1, -1]) {
    B((s * (P + H)) / 2, 0, 0, H - P, 4, 2 * H, 'platform');
    const ups = [s * 0.25 * H, -s * 0.7 * H];
    for (const z of ups) stairs(B, s * P, z, 'x', s, 8, 3);

    // Low walls at the mesa edge, without blocking stairs or bridges
    const keep = [...ups, ...bridges];
    for (let z = -H + 5; z < H - 4; z += 10) {
      if (keep.some((q) => Math.abs(q - z) < 6)) continue;
      B(s * (P + 1), 4, z, 0.8, 1.2, 5, 'wall2');
    }
    // Huts on the mesas
    for (const z of [-0.45, 0.1, 0.6]) {
      B(s * (P + 0.55 * (H - P)), 4, s * z * H, 4, 3, 4, 'wall');
      B(s * (P + 0.55 * (H - P)) - s * 3, 4, s * z * H + 2.5, 1.6, 1.2, 1.6, 'crate');
    }
  }
  for (const z of bridges) B(0, 3.4, z, 2 * P, 0.6, 4, 'bridge');
  // Jump pads at the foot of each mesa (opposite side to the stairs)
  for (const s of [1, -1]) pad(B, s * (P - 2), -s * 0.25 * H);

  // Sandbags at the bridge entrances, cacti and barrels
  for (const s of [1, -1]) {
    for (const z of bridges) Prop(s * (P + 2.6), z + 3.2, sandbags(1, 2));
    for (const z of [-0.45, 0.1, 0.6]) {
      const cx = s * (P + 0.55 * (H - P));
      Prop(cx + s * 2.6, s * z * H - 1.4, BARREL);
      Prop(cx + s * 2.6, s * z * H - 0.4, BARREL);
    }
    for (let i = 0; i < Math.round(H / 6); i++) {
      Prop(s * (P + 2 + rand() * (H - P - 4)), (rand() * 2 - 1) * (H - 3), CACTUS);
    }
  }
  for (let i = 0; i < Math.round(H / 10); i++) Prop((rand() * 2 - 1) * (P - 2), (rand() * 2 - 1) * (H - 4), CACTUS);

  // Rocks on the canyon floor (away from the foot of the stairs and the spawns)
  const avoid = [0.25, 0.7, 0.45, 0.85].flatMap((f) => [f * H, -f * H]);
  for (let z = -H + 7; z < H - 6; z += 8) {
    if (avoid.some((q) => Math.abs(q - z) < 4)) continue;
    const sx = rand() < 0.5 ? 1 : -1;
    const w = 1.8 + rand() * 1.4;
    B(sx * (0.25 + rand() * 0.25) * P, 0, z, w, 1.2 + rand() * 0.9, w, 'rock');
  }

  for (const s of [1, -1]) {
    S(0, s * (H - 3));
    S(s * (H - 3), 0);
    S(s * (H - 3), 0.6 * H);
    S(s * (H - 3), -0.6 * H);
    S(-s * 0.5 * P, s * 0.45 * H);
    S(s * 0.5 * P, -s * 0.85 * H);
  }
}
