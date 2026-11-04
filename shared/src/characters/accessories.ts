// The class's accessory (one per class, picked in the class creator next to the weapons and the ability): a small
// edge with a price. Like the rest of the class, the server checks it at every spawn (classOf), so a client cannot
// equip one its weapons do not allow. The numbers are gameplay: the server applies them (damage, magazines,
// speed), the client predicts them (spread, speed) and draws them (vest, laser, suppressor).
import type { HitZone } from '../physics/raycast';
import { WEAPONS, type Weapon, type WeaponId } from '../weapons/weapons';

export type AccessoryId = 'none' | 'kevlar' | 'helmet' | 'silencer' | 'laser' | 'ammo' | 'goggles' | 'bandage';

export interface Accessory {
  id: AccessoryId;
  name: string;
  /** one line for the tray: what it gives */
  line: string;
  /** what it costs (shown next to the line) */
  cost: string;
  /** the full text for the sheet and the manual */
  desc: string;
}

/**
 * Kevlar vest: damage taken on the torso, and the walking speed while wearing it. The head is the helmet's.
 * Balance, 2026-11-04 (duel.sim): Urban Terror's third off (×0.7, −7 %) won 73 % of duels with the M4 (79 % at
 * one range); ×0.8 and −10 % is +3–8 points (M4 70 %), and the SR8 still kills with one torso shot through it.
 */
export const KEVLAR = { torso: 0.8, speed: 0.9 } as const;
/** Helmet: damage taken on the head (a rifle no longer kills with one head shot). */
export const HELMET = { head: 0.6 } as const;
/**
 * Silencer: no damage lost (2026-11-04: it was ×0.92 and nobody took it). Silenced shots do not show the shooter on
 * the rivals' minimap, draw no tracer nor muzzle flash for them and are heard from much closer.
 */
export const SILENCER = { damage: 1 } as const;
/** Laser sight: hip-fire spread, and the spread that opens while moving (aiming is not affected). */
export const LASER = { hipSpread: 0.6, moveSpread: 0.7 } as const;
/**
 * Extra ammunition. Blockshot has no ammo reserve (a reload always fills the magazine), so the extra ammo goes into
 * the magazine: this much more of it (rounded) in the primary and the secondary; and `grenades` more grenades.
 */
export const EXTRA_AMMO = { mag: 0.5, grenades: 1 } as const;
/** Tactical goggles: a rival you hit shows on your minimap for this long (ms); and smoke does not hide anything. */
export const GOGGLES = { markMs: 3000 } as const;
/** Bandages: health comes back this much sooner (ms) and this many times faster. */
export const BANDAGE = { sooner: 2000, rate: 2 } as const;

export const ACCESSORIES: Record<AccessoryId, Accessory> = {
  none: {
    id: 'none',
    name: 'Ninguno',
    line: 'Sin accesorio.',
    cost: 'Nada que pagar.',
    desc: 'Sales sin accesorio: ni ventajas ni pegas.',
  },
  kevlar: {
    id: 'kevlar',
    name: 'Kevlar',
    line: `Chaleco: −${pct(1 - KEVLAR.torso)} de daño en el torso.`,
    cost: `Andas un ${pct(1 - KEVLAR.speed)} más lento. Cabeza y piernas sin proteger.`,
    desc:
      `Chaleco antibalas. El torso recibe un ${pct(1 - KEVLAR.torso)} menos de daño: los fusiles necesitan una o dos` +
      ` balas más. La cabeza y las piernas no están protegidas. Pesa: andas un ${pct(1 - KEVLAR.speed)} más lento.`,
  },
  helmet: {
    id: 'helmet',
    name: 'Casco',
    line: `−${pct(1 - HELMET.head)} de daño en la cabeza.`,
    cost: 'El torso y las piernas, sin proteger.',
    desc:
      `Casco de combate: la cabeza recibe un ${pct(1 - HELMET.head)} menos de daño, así que los fusiles ya no te` +
      ' matan de un tiro a la cabeza (el SR8 y la railgun, sí). No pesa.',
  },
  silencer: {
    id: 'silencer',
    name: 'Silenciador',
    line: 'Disparas sin trazadora ni fogonazo, sin marca en el minimapa rival y casi sin ruido.',
    cost: 'No en escopetas, explosivos, SR8 ni Desert Eagle.',
    desc:
      'Tus disparos no te delatan: los rivales no ven la trazadora ni el fogonazo, no apareces en su minimapa y ' +
      'suenan mucho más bajo y más cortos. Sin pérdida de daño. No se monta en escopetas, explosivos, el SR8 ni la Desert Eagle.',
  },
  laser: {
    id: 'laser',
    name: 'Láser',
    line: `Desde la cadera, un ${pct(1 - LASER.hipSpread)} más preciso; moviéndote, un ${pct(1 - LASER.moveSpread)}.`,
    cost: 'Los rivales ven tu rayo. Apuntando no cambia nada.',
    desc:
      `Un puntero láser: sin apuntar, la dispersión baja un ${pct(1 - LASER.hipSpread)}, y la que se abre al moverte` +
      ` un ${pct(1 - LASER.moveSpread)}. Apuntando no cambia nada. Los demás ven el rayo y el punto rojo: te delata.`,
  },
  ammo: {
    id: 'ammo',
    name: 'Munición extra',
    line: `Cargadores un ${pct(EXTRA_AMMO.mag)} más grandes y una granada más.`,
    cost: 'Ocupa el hueco del accesorio.',
    desc:
      `Cargadores ampliados: un ${pct(EXTRA_AMMO.mag)} más de balas en la principal y en la secundaria ` +
      '(en Blockshot la recarga siempre llena el cargador, así que la munición de más va dentro), y sales con una ' +
      'granada más. Los explosivos de un tiro no cambian.',
  },
  goggles: {
    id: 'goggles',
    name: 'Gafas tácticas',
    line: `Ves a través del humo, y el rival al que aciertas sale ${GOGGLES.markMs / 1000} s en tu minimapa.`,
    cost: 'Ocupa el hueco del accesorio.',
    desc:
      'Gafas térmicas: el humo no te tapa la vista (los demás siguen sin verte dentro de él), y cada rival al que ' +
      `aciertas aparece ${GOGGLES.markMs / 1000} s en tu minimapa, aunque se esconda.`,
  },
  bandage: {
    id: 'bandage',
    name: 'Vendajes',
    line: `La vida vuelve ${BANDAGE.sooner / 1000} s antes y ${BANDAGE.rate} veces más rápido.`,
    cost: 'Ocupa el hueco del accesorio.',
    desc:
      `Vendas y torniquetes: tras recibir daño empiezas a recuperar vida ${BANDAGE.sooner / 1000} s antes de lo normal` +
      ` y ${BANDAGE.rate} veces más rápido. Para quien entra y sale de los combates.`,
  },
};

/** Every accessory, in the order the class creator lists them (the default first). */
export const ACCESSORY_IDS = Object.keys(ACCESSORIES) as AccessoryId[];
export const isAccessoryId = (v: unknown): v is AccessoryId => typeof v === 'string' && Object.hasOwn(ACCESSORIES, v);

function pct(f: number): string {
  return `${Math.round(f * 100)} %`;
}

/** Why a weapon cannot take a silencer (null: it can). Shotguns, explosives, the SR8 and the Desert Eagle cannot. */
export function silencerBlock(id: WeaponId): string | null {
  const w = WEAPONS[id];
  if (w.pellets > 1) return 'las escopetas';
  if (w.projectile) return 'los explosivos';
  if (id === 'sniper' || id === 'heavypistol') return w.name;
  return null;
}

/**
 * Why a class cannot carry this accessory (null: it can). Only the silencer depends on the weapons: both the primary
 * and the secondary must take one.
 */
export function accessoryBlock(acc: AccessoryId, primary: WeaponId, secondary: WeaponId): string | null {
  if (acc !== 'silencer') return null;
  const blocked = [primary, secondary].filter((id) => silencerBlock(id));
  if (!blocked.length) return null;
  return `No admite silenciador: ${blocked.map((id) => WEAPONS[id].name).join(' ni ')}`;
}

/** The accessory a class really carries: the pick when allowed with its weapons, none otherwise. */
export const fitAccessory = (acc: AccessoryId, primary: WeaponId, secondary: WeaponId): AccessoryId =>
  accessoryBlock(acc, primary, secondary) ? 'none' : acc;

/** Weapons the accessory leaves alone: the knife and the power weapons found on the map. */
const untouched = (w: Weapon) => !!w.melee || !!w.power;

const geared = new Map<string, Weapon>();
/**
 * A weapon as carried with an accessory: the silencer takes some damage, the laser tightens the hip-fire cone and
 * the extra ammo enlarges the magazine. The knife and power weapons never change. Cached (the same object every
 * time), so it is cheap to call on every shot.
 */
export function gearedWeapon(id: WeaponId, acc: AccessoryId | null | undefined): Weapon {
  const w = WEAPONS[id];
  if (!acc || acc === 'none' || untouched(w)) return w;
  const key = `${id}|${acc}`;
  let out = geared.get(key);
  if (out) return out;
  out = { ...w };
  if (acc === 'silencer' && !silencerBlock(id)) out.damage = w.damage * SILENCER.damage;
  if (acc === 'laser') {
    out.spread = w.spread * LASER.hipSpread;
    if (w.moveSpread !== undefined) out.moveSpread = w.moveSpread * LASER.moveSpread;
  }
  // (a one-shot launcher stays one shot)
  if (acc === 'ammo' && w.mag > 1) out.mag = w.mag + Math.round(w.mag * EXTRA_AMMO.mag);
  geared.set(key, out);
  return out;
}

/** Whether a shot with this weapon and accessory is silenced (no minimap mark, a muffled sound). */
export const silenced = (id: WeaponId, acc: AccessoryId | null | undefined): boolean =>
  acc === 'silencer' && !untouched(WEAPONS[id]) && !silencerBlock(id);

/** Walking speed multiplier of the accessory (the Kevlar weighs). */
export const accessorySpeed = (acc: AccessoryId | null | undefined): number => (acc === 'kevlar' ? KEVLAR.speed : 1);

/** Damage multiplier of a hit on the legs (`limb` zone, raycast.ts), of the torso's. */
export const LIMB_MULT = 0.6;

/**
 * Damage of one bullet on a zone: the weapon's head multiplier on the head, LIMB_MULT on the legs, the victim's
 * helmet on the head and Kevlar on the torso (never on the limbs).
 */
export function zoneDamage(dmg: number, w: Weapon, zone: HitZone, victimAcc?: AccessoryId | null): number {
  if (zone === 'head') return dmg * w.headMult * (victimAcc === 'helmet' ? HELMET.head : 1);
  if (zone === 'limb') return dmg * LIMB_MULT;
  return dmg * (victimAcc === 'kevlar' ? KEVLAR.torso : 1);
}

/** Grenades the accessory adds at spawn (when the mode hands any out). */
export const accessoryGrenades = (acc: AccessoryId | null | undefined): number =>
  acc === 'ammo' ? EXTRA_AMMO.grenades : 0;

/** Health regeneration with the accessory: [delay before it starts (ms), hp per second]. */
export const regenOf = (acc: AccessoryId | null | undefined, delay: number, rate: number): [number, number] =>
  acc === 'bandage' ? [delay - BANDAGE.sooner, rate * BANDAGE.rate] : [delay, rate];
