import { ABILITIES, ABILITY_IDS, type AbilityId } from '../abilities/abilities';
import { WEAPONS, type WeaponId } from '../weapons/weapons';
import { ACCESSORY_IDS, accessorySpeed, fitAccessory, type AccessoryId } from './accessories';

// Classes (Urban Terror style): everybody has the same body, and a class is a primary, a sidearm, an ability and an
// accessory (accessories.ts), worn with the player's looks (face, outfit colour, camouflage, finish). There are no
// named characters: each player builds one class («Mi clase») on the class screen.

/** The body every player shares: health and walking speed (m/s); only the held weapon's `weight` changes the speed. */
export const BODY = { hp: 100, speed: 7.3 } as const;

/** Sidearms (key 2). */
export const SIDEARMS: WeaponId[] = ['pistol', 'colt', 'heavypistol', 'revolver', 'mpistol'];

/**
 * Primaries (key 1) by family, in the order the class screen shows them. Never the knife nor a power weapon, and
 * (2026-11-04) never a pistol: pistols are sidearms only.
 */
export const PRIMARY_FAMILIES: { name: string; weapons: WeaponId[] }[] = [
  { name: 'Fusiles', weapons: ['rifle', 'heavyrifle', 'lightrifle', 'carbine'] },
  { name: 'Precisión', weapons: ['sniper', 'frf1', 'dmr'] },
  { name: 'Subfusiles', weapons: ['smg', 'ump45', 'pdw', 'compact'] },
  { name: 'Escopetas', weapons: ['shotgun', 'benelli', 'sawedoff'] },
  { name: 'Ametralladoras', weapons: ['lmg', 'lightlmg'] },
  { name: 'Explosivos', weapons: ['launcher', 'grenadelauncher'] },
];
export const PRIMARIES: WeaponId[] = PRIMARY_FAMILIES.flatMap((f) => f.weapons);

/** What a player goes out with besides the looks: key 1, key 2, key E and the accessory. */
export interface PlayerClass {
  primary: WeaponId;
  secondary: WeaponId;
  ability: AbilityId;
  accessory: AccessoryId;
}

/** The class everybody starts from (and what any missing or unknown part falls back to). */
export const DEFAULT_CLASS: PlayerClass = {
  primary: 'rifle',
  secondary: 'pistol',
  ability: 'smoke',
  accessory: 'none',
};

/** Who you are (the head and bare skin); `base` is the human. Only a look: the body and stats are the same. */
export type SkinId =
  | 'base'
  | 'alien'
  | 'mapache'
  | 'robot'
  | 'oso'
  | 'astronauta'
  | 'zombi'
  | 'rana'
  | 'gato'
  | 'calabaza'
  | 'ninja'
  | 'pirata'
  | 'caballero'
  | 'vikingo'
  | 'esqueleto'
  | 'panda'
  | 'pinguino'
  | 'perro'
  | 'dino'
  | 'buho';

/** Skins only change the look, never the stats (the models live in the client). */
export const SKINS: { id: SkinId; name: string }[] = [
  { id: 'base', name: 'Humano' },
  { id: 'alien', name: 'Alien' },
  { id: 'mapache', name: 'Mapache' },
  { id: 'robot', name: 'Robot' },
  { id: 'oso', name: 'Oso' },
  { id: 'astronauta', name: 'Astronauta' },
  { id: 'zombi', name: 'Zombi' },
  { id: 'rana', name: 'Rana' },
  { id: 'gato', name: 'Gato' },
  { id: 'calabaza', name: 'Calabaza' },
  { id: 'ninja', name: 'Ninja' },
  { id: 'pirata', name: 'Pirata' },
  { id: 'caballero', name: 'Caballero' },
  { id: 'vikingo', name: 'Vikingo' },
  { id: 'esqueleto', name: 'Esqueleto' },
  { id: 'panda', name: 'Panda' },
  { id: 'pinguino', name: 'Pingüino' },
  { id: 'perro', name: 'Perro' },
  { id: 'dino', name: 'Dinosaurio' },
  { id: 'buho', name: 'Búho' },
];
export const isSkinId = (v: unknown): v is SkinId => SKINS.some((k) => k.id === v);

/**
 * Outfit colours a player can pick. Only seen in free for all: team modes dress everybody in the team colour.
 * The first one is the default.
 */
export const OUTFIT_COLORS = [
  { hex: '#3f7fe0', name: 'Azul' },
  { hex: '#3aa65a', name: 'Verde' },
  { hex: '#d0533a', name: 'Rojo' },
  { hex: '#e8b923', name: 'Amarillo' },
  { hex: '#8a5cd6', name: 'Morado' },
  { hex: '#26b0a6', name: 'Turquesa' },
  { hex: '#e0782e', name: 'Naranja' },
  { hex: '#e0609e', name: 'Rosa' },
  { hex: '#5f6873', name: 'Grafito' },
  { hex: '#b8935a', name: 'Arena' },
] as const;
export type OutfitColor = (typeof OUTFIT_COLORS)[number]['hex'];
export const DEFAULT_OUTFIT_COLOR: string = OUTFIT_COLORS[0].hex;
export const OUTFIT_COLOR_HEXES = OUTFIT_COLORS.map((c) => c.hex);
export const isOutfitColor = (v: unknown): v is OutfitColor => OUTFIT_COLORS.some((c) => c.hex === v);

/** The player's class pick (from the class screen; untrusted on the server). */
export interface ClassChoice {
  primary?: string | null;
  secondary?: string | null;
  ability?: string | null;
  accessory?: string | null;
}

/**
 * The class a player goes out with: each part of the pick when it is allowed, the default's otherwise (an accessory
 * the weapons do not take, like a silencer on a shotgun, becomes none). The server runs every spawn request through
 * this, so a client cannot equip anything else.
 */
export function classOf(choice?: ClassChoice | null): PlayerClass {
  const pick = <T extends string>(list: readonly T[], v: string | null | undefined, fallback: T): T =>
    list.find((id) => id === v) ?? fallback;
  const primary = pick(PRIMARIES, choice?.primary, DEFAULT_CLASS.primary);
  const secondary = pick(SIDEARMS, choice?.secondary, DEFAULT_CLASS.secondary);
  return {
    primary,
    secondary,
    ability: pick(ABILITY_IDS, choice?.ability, DEFAULT_CLASS.ability),
    accessory: fitAccessory(pick(ACCESSORY_IDS, choice?.accessory, DEFAULT_CLASS.accessory), primary, secondary),
  };
}

/** The class as two small indices plus the ability, for snapshots: [primary in PRIMARIES, secondary in SIDEARMS]. */
export const classIndex = (c: Pick<PlayerClass, 'primary' | 'secondary'>): [number, number] => [
  Math.max(0, PRIMARIES.indexOf(c.primary)),
  Math.max(0, SIDEARMS.indexOf(c.secondary)),
];
export const classFromIndex = (wc: readonly number[] | undefined): Pick<PlayerClass, 'primary' | 'secondary'> => ({
  primary: PRIMARIES[wc?.[0] ?? 0] ?? DEFAULT_CLASS.primary,
  secondary: SIDEARMS[wc?.[1] ?? 0] ?? DEFAULT_CLASS.secondary,
});

/** A class in a few words for the HUD and the death card: «M4 · Humo». */
export const classLabel = (c: PlayerClass): string => `${WEAPONS[c.primary].name} · ${ABILITIES[c.ability].name}`;

/** Real speed of a player holding a weapon (m/s): the common body times the weapon's weight (and the Kevlar's). */
export const speedWith = (weaponId: WeaponId, accessory?: AccessoryId | null): number =>
  +(BODY.speed * WEAPONS[weaponId].weight * accessorySpeed(accessory)).toFixed(1);
