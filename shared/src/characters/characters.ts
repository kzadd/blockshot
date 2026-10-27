import type { AbilityId } from '../abilities/abilities';
import { WEAPONS, type WeaponId } from '../weapons/weapons';

export type CharacterId = 'soldado' | 'cazador' | 'tanque' | 'rayo' | 'bastion' | 'explorador' | 'artillero';

export interface Character {
  id: CharacterId;
  name: string;
  color: string;
  hp: number;
  speed: number;
  primary: WeaponId;
  secondary: WeaponId;
  /** key E */
  ability: AbilityId;
  role: string;
  desc: string;
}

export const CHARACTERS: Character[] = [
  {
    id: 'soldado',
    name: 'Soldado',
    color: '#3f7fe0',
    hp: 100,
    speed: 7.3,
    primary: 'rifle',
    secondary: 'pistol',
    ability: 'smoke',
    role: 'Equilibrado',
    desc: 'Equilibrado. Rinde a cualquier distancia y perdona los fallos.',
  },
  {
    id: 'cazador',
    name: 'Cazador',
    color: '#3aa65a',
    hp: 90,
    speed: 7.6,
    primary: 'sniper',
    secondary: 'mpistol',
    ability: 'mine',
    role: 'Larga distancia',
    desc: 'Un tiro al cuerpo tumba a todos menos al Tanque (a él, a la cabeza). Busca altura.',
  },
  {
    id: 'tanque',
    name: 'Tanque',
    color: '#d0533a',
    hp: 140,
    speed: 6.8,
    primary: 'shotgun',
    secondary: 'revolver',
    ability: 'shield',
    role: 'Cuerpo a cuerpo',
    desc: 'Mucha vida y escopeta. Letal de cerca, lento de lejos.',
  },
  {
    id: 'rayo',
    name: 'Rayo',
    color: '#e8b923',
    hp: 90,
    speed: 8.6,
    primary: 'smg',
    secondary: 'pistol',
    ability: 'dash',
    role: 'Velocidad',
    desc: 'El más rápido. Entra, dispara y sal antes de que te vean.',
  },
  {
    id: 'bastion',
    name: 'Bastión',
    color: '#8a5cd6',
    hp: 120,
    speed: 7.3,
    primary: 'lmg',
    secondary: 'revolver',
    ability: 'wall',
    role: 'Supresión',
    desc: 'Cargador de 80 balas. Aguanta una esquina él solo.',
  },
  {
    id: 'explorador',
    name: 'Explorador',
    color: '#26b0a6',
    hp: 90,
    speed: 8.0,
    primary: 'dmr',
    secondary: 'pistol',
    ability: 'radar',
    role: 'Media distancia',
    desc: 'Fusil de tirador semiautomático: dos tiros a la cabeza. Rápido y con radar para cazar francotiradores.',
  },
  {
    id: 'artillero',
    name: 'Artillero',
    color: '#e0782e',
    hp: 115,
    speed: 7.4,
    primary: 'launcher',
    secondary: 'sawedoff',
    ability: 'medkit',
    role: 'Área',
    desc: 'Lanzagranadas que estalla al tocar: saca a la gente de las esquinas. Lento y sin tiros a la cabeza.',
  },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, Character>;
export const isCharacterId = (v: unknown): v is CharacterId => typeof v === 'string' && Object.hasOwn(CHAR_BY_ID, v);

/** Who you are (the head and bare skin); `base` is the human. The class still decides the body and stats. */
export type SkinId =
  'base' | 'alien' | 'mapache' | 'robot' | 'oso' | 'astronauta' | 'zombi' | 'rana' | 'gato' | 'calabaza';

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
];
export const isSkinId = (v: unknown): v is SkinId => SKINS.some((k) => k.id === v);

/**
 * Outfit colours a player can pick per character. Only seen in free for all: team modes dress everybody in
 * the team colour. The first five are the class colours (each character's default).
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
] as const;
export type OutfitColor = (typeof OUTFIT_COLORS)[number]['hex'];
export const OUTFIT_COLOR_HEXES = OUTFIT_COLORS.map((c) => c.hex);
export const isOutfitColor = (v: unknown): v is OutfitColor => OUTFIT_COLORS.some((c) => c.hex === v);

/** Real speed of a character holding a weapon (m/s). */
export const speedWith = (c: Character, weaponId: WeaponId): number => +(c.speed * WEAPONS[weaponId].weight).toFixed(1);
