export type WeaponId =
  | 'rifle'
  | 'sniper'
  | 'shotgun'
  | 'smg'
  | 'lmg'
  | 'pistol'
  | 'revolver'
  | 'knife'
  | 'dmr'
  | 'launcher'
  | 'mpistol'
  | 'sawedoff'
  // more guns for the class creator (characters.ts PRIMARY_FAMILIES / SIDEARMS)
  | 'heavyrifle'
  | 'lightrifle'
  | 'carbine'
  | 'pdw'
  | 'compact'
  | 'heavypistol'
  | 'grenadelauncher'
  | 'lightlmg'
  | 'ump45'
  | 'frf1'
  | 'colt'
  | 'benelli'
  // power weapons: found on the map, not carried by any character
  | 'railgun'
  | 'minigun'
  | 'autoshotgun';

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
  /** fires a grenade that flies and blows up on contact (LAUNCHER) instead of a bullet */
  projectile?: boolean;
  /** with `projectile`: the round arcs and bounces, and blows up on its short fuse or on touching a rival (GL_ROUND) */
  lob?: boolean;
  /** power weapon (found on the map): one magazine, no reload; it goes when empty or when you die */
  power?: boolean;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  rifle: {
    name: 'M4',
    damage: 26,
    headMult: 2.2,
    fireRate: 105,
    mag: 30,
    reload: 2000,
    auto: true,
    spread: 0.006,
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
    // Long bursts open up: deadly up close, it has to tap at range
    bloom: 0.0018,
    bloomMax: 0.014,
  },
  sniper: {
    name: 'SR8',
    damage: 145, // 2026-11-04: still one torso shot through Kevlar (×0.7)
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
    // Slow to scope in: quick scopes are a gamble (it ruled every match)
    adsSpeed: 7,
    adsMove: 0.55,
    moveSpread: 3,
    airSpread: 4,
    bolt: true,
  },
  // Semi-auto marksman rifle: two headshots or three body shots; wins the middle distance
  dmr: {
    name: 'PSG1',
    damage: 48,
    headMult: 2.2,
    fireRate: 290,
    mag: 12,
    reload: 2300,
    auto: false,
    spread: 0.02,
    adsSpread: 0.0012,
    pellets: 1,
    range: 300,
    recoil: 0.032,
    zoom: 2.6,
    // A telescopic sight like the bolt rifles (overlay, glint), but semi-auto: no bolt to cycle
    scope: true,
    sound: 'dmr',
    weight: 0.98,
    adsSpeed: 10,
    adsMove: 0.6,
    moveSpread: 1.6,
    airSpread: 2.5,
  },
  // Grenade launcher: slow rounds that blow up on contact (area damage), no headshots
  launcher: {
    name: 'Bazuca',
    damage: 110,
    headMult: 1,
    fireRate: 950,
    mag: 1,
    reload: 2300,
    auto: false,
    spread: 0.012,
    adsSpread: 0.004,
    pellets: 1,
    range: 80,
    recoil: 0.07,
    zoom: 1.4,
    sound: 'launcher',
    weight: 0.92,
    adsSpeed: 9,
    adsMove: 0.6,
    projectile: true,
  },
  shotgun: {
    name: 'SPAS-12',
    damage: 13,
    headMult: 1.3,
    fireRate: 850,
    mag: 6,
    reload: 2400,
    auto: false,
    spread: 0.065,
    adsSpread: 0.052,
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
    name: 'MP5K',
    damage: 22,
    headMult: 1.8,
    fireRate: 120, // Urban Terror: ~500 rpm
    mag: 35,
    reload: 1600,
    auto: true,
    spread: 0.012,
    adsSpread: 0.007,
    pellets: 1,
    range: 90,
    recoil: 0.0055,
    zoom: 1.4,
    sound: 'smg',
    weight: 1,
    adsSpeed: 20,
    adsMove: 0.75,
    falloff: [12, 35, 0.55],
    bloom: 0.0016,
    bloomMax: 0.02,
  },
  lmg: {
    name: 'M60',
    damage: 22,
    headMult: 1.8,
    fireRate: 115,
    mag: 80,
    reload: 4200,
    auto: true,
    spread: 0.012,
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
    bloomMax: 0.016,
  },
  pistol: {
    name: 'Beretta 92G',
    damage: 28,
    headMult: 2,
    fireRate: 220,
    mag: 12,
    reload: 1300,
    auto: false,
    spread: 0.005,
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
    bloomMax: 0.01,
  },
  revolver: {
    name: 'Magnum',
    damage: 50,
    headMult: 1.8,
    fireRate: 600,
    mag: 6,
    reload: 2200,
    auto: false,
    spread: 0.006,
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
  // Machine pistol: a tiny automatic sidearm, deadly up close, useless far away
  mpistol: {
    name: 'Glock 18',
    damage: 15,
    headMult: 1.7,
    fireRate: 72,
    mag: 20,
    reload: 1500,
    auto: true,
    spread: 0.016,
    adsSpread: 0.014,
    pellets: 1,
    range: 60,
    recoil: 0.012,
    zoom: 1.3,
    sound: 'smg',
    weight: 1.03,
    adsSpeed: 20,
    adsMove: 0.85,
    falloff: [10, 35, 0.5],
    bloom: 0.002,
    bloomMax: 0.014,
  },
  // Sawed-off: two barrels, two shots, a wide cone that only works at arm's length
  sawedoff: {
    name: 'Recortada',
    damage: 12,
    headMult: 1.2,
    fireRate: 260,
    mag: 2,
    reload: 1700,
    auto: false,
    spread: 0.09,
    adsSpread: 0.075,
    pellets: 9,
    range: 20,
    recoil: 0.06,
    zoom: 1.15,
    sound: 'shotgun',
    weight: 1.02,
    adsSpeed: 18,
    adsMove: 0.8,
    falloff: [5, 16, 0.3],
  },
  // Heavy rifle: hits harder than the assault rifle but fires slower and kicks a lot (three body shots)
  heavyrifle: {
    name: 'AK103',
    damage: 34,
    headMult: 2,
    fireRate: 170,
    mag: 25,
    reload: 2400,
    auto: true,
    spread: 0.008,
    adsSpread: 0.0026,
    pellets: 1,
    range: 200,
    recoil: 0.013,
    zoom: 1.6,
    sound: 'heavyrifle',
    weight: 0.95,
    adsSpeed: 11,
    adsMove: 0.55,
    falloff: [30, 80, 0.65],
    bloom: 0.0035,
    bloomMax: 0.024,
  },
  // Light rifle: quick and easy to control, but each bullet does little
  lightrifle: {
    name: 'LR300',
    damage: 26,
    headMult: 2.1,
    fireRate: 133, // Urban Terror: ~450 rpm
    mag: 30,
    reload: 1800,
    auto: true,
    spread: 0.006,
    adsSpread: 0.0022,
    pellets: 1,
    range: 180,
    recoil: 0.005,
    zoom: 1.5,
    sound: 'lightrifle',
    weight: 1,
    adsSpeed: 14,
    adsMove: 0.65,
    falloff: [25, 70, 0.6],
    bloom: 0.0012,
    bloomMax: 0.01,
  },
  // Carbine: an accurate automatic rifle with a 2× sight; mid damage, rewards aiming
  carbine: {
    name: 'G36',
    damage: 27,
    headMult: 2.2,
    fireRate: 158, // Urban Terror: ~380 rpm
    mag: 30,
    reload: 2100,
    auto: true,
    spread: 0.008,
    adsSpread: 0.0012,
    pellets: 1,
    range: 220,
    recoil: 0.0065,
    zoom: 2,
    sound: 'carbine',
    weight: 0.97,
    adsSpeed: 10,
    adsMove: 0.55,
    falloff: [35, 90, 0.7],
    moveSpread: 1.4,
    bloom: 0.0014,
    bloomMax: 0.011,
  },
  // Tactical SMG: a 50-round magazine and a steady stream that still works at mid range
  pdw: {
    name: 'P90',
    damage: 17,
    headMult: 1.8,
    fireRate: 80,
    mag: 50,
    reload: 2300,
    auto: true,
    spread: 0.011,
    adsSpread: 0.0055,
    pellets: 1,
    range: 120,
    recoil: 0.0045,
    zoom: 1.4,
    sound: 'pdw',
    weight: 0.97,
    adsSpeed: 16,
    adsMove: 0.7,
    falloff: [18, 50, 0.6],
    bloom: 0.0012,
    bloomMax: 0.015,
  },
  // Compact SMG: a light hose up close (very high fire rate), a wild cone even aimed and nothing left at range
  compact: {
    name: 'MAC-11',
    damage: 14,
    headMult: 1.6,
    fireRate: 52,
    mag: 32,
    reload: 1500,
    auto: true,
    spread: 0.024,
    adsSpread: 0.015,
    pellets: 1,
    range: 60,
    recoil: 0.006,
    zoom: 1.3,
    sound: 'compact',
    weight: 1.04,
    adsSpeed: 22,
    adsMove: 0.8,
    falloff: [8, 28, 0.55],
    moveSpread: 2,
    bloom: 0.003,
    bloomMax: 0.03,
  },
  // Heavy pistol: few, heavy, slow shots with a strong kick (three to the body, two to the head)
  heavypistol: {
    name: 'Desert Eagle',
    damage: 45,
    headMult: 2,
    fireRate: 330,
    mag: 7,
    reload: 1800,
    auto: false,
    spread: 0.006,
    adsSpread: 0.002,
    pellets: 1,
    range: 110,
    recoil: 0.036,
    zoom: 1.4,
    sound: 'heavypistol',
    weight: 1.01,
    adsSpeed: 16,
    adsMove: 0.75,
    falloff: [20, 60, 0.65],
    bloom: 0.006,
    bloomMax: 0.016,
  },
  // Grenade launcher: lobs bouncing grenades on a short fuse (GL_ROUND); smaller blast than the bazooka, four rounds
  grenadelauncher: {
    name: 'HK69',
    damage: 90,
    headMult: 1,
    fireRate: 450,
    mag: 4,
    reload: 2800,
    auto: false,
    spread: 0.01,
    adsSpread: 0.005,
    pellets: 1,
    range: 60,
    recoil: 0.06,
    zoom: 1.3,
    sound: 'grenadelauncher',
    weight: 0.93,
    adsSpeed: 10,
    adsMove: 0.6,
    projectile: true,
    lob: true,
  },
  // Negev: the mobile machine gun; a 90-round belt, lighter and quicker to aim than the M60, but less damage per
  // bullet and a wider cone
  lightlmg: {
    name: 'Negev',
    damage: 19,
    headMult: 1.8,
    fireRate: 100,
    mag: 90,
    reload: 3800,
    auto: true,
    spread: 0.014,
    adsSpread: 0.006,
    pellets: 1,
    range: 150,
    recoil: 0.007,
    zoom: 1.45,
    sound: 'lightlmg',
    weight: 0.95,
    adsSpeed: 13,
    adsMove: 0.6,
    falloff: [28, 85, 0.62],
    bloom: 0.0016,
    bloomMax: 0.018,
  },
  // UMP45: the heavy-hitting SMG; fewer, bigger bullets than the MP5K and a short 25-round magazine
  ump45: {
    name: 'UMP45',
    damage: 27,
    headMult: 1.8,
    fireRate: 143, // Urban Terror: ~420 rpm
    mag: 25,
    reload: 2000,
    auto: true,
    spread: 0.012,
    adsSpread: 0.006,
    pellets: 1,
    range: 100,
    recoil: 0.0075,
    zoom: 1.4,
    sound: 'ump45',
    weight: 0.99,
    adsSpeed: 17,
    adsMove: 0.72,
    falloff: [14, 42, 0.55],
    bloom: 0.0018,
    bloomMax: 0.02,
  },
  // FR-F1: a lighter bolt-action rifle, quicker to aim than the SR8; a body shot does not kill, a headshot does
  frf1: {
    name: 'FR-F1',
    damage: 85,
    headMult: 2,
    fireRate: 600,
    boltTime: 200,
    mag: 10,
    reload: 2400,
    auto: false,
    spread: 0.1,
    adsSpread: 0.001,
    pellets: 1,
    range: 350,
    recoil: 0.06,
    zoom: 3.5,
    scope: true,
    sound: 'frf1',
    weight: 0.97,
    adsSpeed: 13,
    adsMove: 0.6,
    moveSpread: 2.5,
    airSpread: 3.5,
    bolt: true,
  },
  // Colt 1911: the .45, between the Beretta and the Desert Eagle (three body shots, eight rounds)
  colt: {
    name: 'Colt 1911',
    damage: 36,
    headMult: 2,
    fireRate: 290,
    mag: 8,
    reload: 1500,
    auto: false,
    spread: 0.0055,
    adsSpread: 0.0022,
    pellets: 1,
    range: 105,
    recoil: 0.026,
    zoom: 1.38,
    sound: 'colt',
    weight: 1.02,
    adsSpeed: 18,
    adsMove: 0.78,
    falloff: [20, 60, 0.65],
    bloom: 0.0045,
    bloomMax: 0.013,
  },
  // Benelli: a semi-automatic shotgun; quicker follow-up shots than the SPAS-12, less damage in each
  benelli: {
    name: 'Benelli',
    damage: 11,
    headMult: 1.3,
    fireRate: 400,
    mag: 7,
    reload: 2600,
    auto: false,
    spread: 0.07,
    adsSpread: 0.056,
    pellets: 9,
    range: 30,
    recoil: 0.045,
    zoom: 1.25,
    sound: 'benelli',
    weight: 0.96,
    adsSpeed: 14,
    adsMove: 0.65,
    falloff: [7, 28, 0.35],
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
  // Power weapons: they appear on the map now and then (shared/src/maps/objects.ts POWER) for whoever gets there
  railgun: {
    name: 'Railgun',
    damage: 150,
    headMult: 1,
    fireRate: 1100,
    mag: 5,
    reload: 0,
    auto: false,
    spread: 0.003,
    adsSpread: 0,
    pellets: 1,
    range: 300,
    recoil: 0.06,
    // The sniper's full-screen scope
    zoom: 4,
    scope: true,
    sound: 'sniper',
    weight: 0.95,
    adsSpeed: 10,
    adsMove: 0.6,
    power: true,
  },
  minigun: {
    name: 'Minigun',
    damage: 15,
    headMult: 1.4,
    fireRate: 45,
    mag: 160,
    reload: 0,
    auto: true,
    spread: 0.028,
    adsSpread: 0.02,
    pellets: 1,
    range: 120,
    recoil: 0.004,
    zoom: 1.2,
    sound: 'lmg',
    weight: 0.78,
    adsSpeed: 8,
    adsMove: 0.5,
    falloff: [25, 60, 0.6],
    power: true,
  },
  autoshotgun: {
    name: 'AA-12',
    damage: 12,
    headMult: 1.2,
    fireRate: 220,
    mag: 14,
    reload: 0,
    auto: true,
    spread: 0.09,
    adsSpread: 0.07,
    pellets: 8,
    range: 40,
    recoil: 0.03,
    zoom: 1.15,
    sound: 'shotgun',
    weight: 1,
    adsSpeed: 14,
    adsMove: 0.8,
    falloff: [6, 18, 0.35],
    power: true,
  },
};

export const isWeaponId = (v: unknown): v is WeaponId => typeof v === 'string' && Object.hasOwn(WEAPONS, v);

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

/** The power weapons, in the order they take turns on the map. */
export const POWER_WEAPONS: WeaponId[] = ['railgun', 'minigun', 'autoshotgun'];
