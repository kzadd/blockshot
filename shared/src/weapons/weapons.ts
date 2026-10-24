export type WeaponId = 'rifle' | 'sniper' | 'shotgun' | 'smg' | 'lmg' | 'pistol' | 'revolver' | 'knife';

/**
 * fireRate = ms between shots · spread = radians (adsSpread while aiming) · zoom while aiming
 * weight = speed multiplier while held (heavy < 1 < light)
 * adsSpeed = how fast aiming completes (higher = sooner) · adsMove = speed while aiming
 * falloff = [from m, to m, min damage factor]: damage drops with distance
 * moveSpread / airSpread = how much spread opens while running / in the air
 * bolt = bolt action: after each shot the scope is left for boltTime ms
 * bloom = spread added per consecutive shot (up to bloomMax); the first shot goes to the centre
 */
export interface Weapon {
  name: string;
  damage: number;
  headMult: number;
  fireRate: number;
  boltTime?: number;
  mag: number;
  reload: number;
  auto: boolean;
  spread: number;
  adsSpread: number;
  pellets: number;
  range: number;
  recoil: number;
  zoom: number;
  scope?: boolean;
  sound: WeaponId;
  weight: number;
  adsSpeed: number;
  adsMove: number;
  falloff?: [number, number, number];
  moveSpread?: number;
  airSpread?: number;
  bolt?: boolean;
  bloom?: number;
  bloomMax?: number;
  melee?: boolean;
  backstab?: number;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  rifle: {
    name: 'Rifle de asalto',
    damage: 24,
    headMult: 1.6,
    fireRate: 105,
    mag: 30,
    reload: 2000,
    auto: true,
    spread: 0.012,
    adsSpread: 0.002,
    pellets: 1,
    range: 200,
    recoil: 0.008,
    zoom: 1.6,
    sound: 'rifle',
    weight: 0.97,
    adsSpeed: 12,
    adsMove: 0.6,
    falloff: [30, 80, 0.65],
    bloom: 0.0022,
    bloomMax: 0.018,
  },
  sniper: {
    name: 'Francotirador',
    damage: 120,
    headMult: 2,
    fireRate: 1100,
    boltTime: 550,
    mag: 5,
    reload: 2700,
    auto: false,
    spread: 0.12,
    adsSpread: 0.0008,
    pellets: 1,
    range: 400,
    recoil: 0.07,
    zoom: 5,
    scope: true,
    sound: 'sniper',
    weight: 0.95,
    adsSpeed: 12,
    adsMove: 0.55,
    moveSpread: 3,
    airSpread: 4,
    bolt: true,
  },
  shotgun: {
    name: 'Escopeta',
    damage: 13,
    headMult: 1.3,
    fireRate: 850,
    mag: 6,
    reload: 2400,
    auto: false,
    spread: 0.075,
    adsSpread: 0.06,
    pellets: 10,
    range: 32,
    recoil: 0.05,
    zoom: 1.25,
    sound: 'shotgun',
    weight: 0.95,
    adsSpeed: 14,
    adsMove: 0.65,
    falloff: [8, 30, 0.35],
  },
  smg: {
    name: 'Subfusil',
    damage: 16,
    headMult: 1.5,
    fireRate: 68,
    mag: 35,
    reload: 1600,
    auto: true,
    spread: 0.018,
    adsSpread: 0.007,
    pellets: 1,
    range: 90,
    recoil: 0.0055,
    zoom: 1.4,
    sound: 'smg',
    weight: 1,
    adsSpeed: 20,
    adsMove: 0.75,
    falloff: [20, 55, 0.6],
    bloom: 0.0016,
    bloomMax: 0.018,
  },
  lmg: {
    name: 'Ametralladora',
    damage: 21,
    headMult: 1.5,
    fireRate: 115,
    mag: 80,
    reload: 4200,
    auto: true,
    spread: 0.018,
    adsSpread: 0.005,
    pellets: 1,
    range: 160,
    recoil: 0.0075,
    zoom: 1.5,
    sound: 'lmg',
    weight: 0.9,
    adsSpeed: 10,
    adsMove: 0.55,
    falloff: [35, 95, 0.65],
    bloom: 0.0015,
    bloomMax: 0.02,
  },
  pistol: {
    name: 'Pistola',
    damage: 25,
    headMult: 1.6,
    fireRate: 220,
    mag: 12,
    reload: 1300,
    auto: false,
    spread: 0.008,
    adsSpread: 0.0025,
    pellets: 1,
    range: 100,
    recoil: 0.018,
    zoom: 1.35,
    sound: 'pistol',
    weight: 1.03,
    adsSpeed: 20,
    adsMove: 0.8,
    falloff: [20, 60, 0.65],
    bloom: 0.003,
    bloomMax: 0.012,
  },
  revolver: {
    name: 'Revólver',
    damage: 50,
    headMult: 1.8,
    fireRate: 600,
    mag: 6,
    reload: 2200,
    auto: false,
    spread: 0.008,
    adsSpread: 0.0018,
    pellets: 1,
    range: 120,
    recoil: 0.04,
    zoom: 1.5,
    sound: 'revolver',
    weight: 1,
    adsSpeed: 14,
    adsMove: 0.7,
    falloff: [25, 70, 0.7],
    bloom: 0.005,
    bloomMax: 0.014,
  },
  // Melee: everybody carries it (key 3). From behind it kills in one hit
  knife: {
    name: 'Cuchillo',
    damage: 55,
    headMult: 1.2,
    fireRate: 480,
    mag: 1,
    reload: 0,
    auto: true,
    spread: 0,
    adsSpread: 0,
    pellets: 1,
    range: 2.6,
    recoil: 0,
    zoom: 1,
    sound: 'knife',
    weight: 1.12,
    adsSpeed: 20,
    adsMove: 1,
    melee: true,
    backstab: 200,
  },
};

/** Weapon weight in words (character select and manual). */
export const weightName = (w: Weapon): string => (w.weight >= 1 ? 'Ligera' : w.weight >= 0.95 ? 'Media' : 'Pesada');

/** Damage of one hit at a given distance (used by the server; shown in the manual). */
export function damageAt(w: Weapon, dist: number): number {
  if (!w.falloff) return w.damage;
  const [a, b, min] = w.falloff;
  const k = Math.max(0, Math.min(1, (dist - a) / (b - a)));
  return w.damage * (1 - k * (1 - min));
}

/** Melee assist: a target inside this cone (dot product) counts as hit even without pixel aim. */
export const MELEE_ASSIST_DOT = 0.8;
/** Backstab: attacker behind the victim's facing (dot product below this). */
export const BACKSTAB_DOT = -0.35;
