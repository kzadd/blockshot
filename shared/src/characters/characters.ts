import { WEAPONS, type WeaponId } from '../weapons/weapons';

export type CharacterId = 'soldado' | 'cazador' | 'tanque' | 'rayo' | 'bastion';

export interface Character {
  id: CharacterId;
  name: string;
  color: string;
  hp: number;
  speed: number;
  primary: WeaponId;
  secondary: WeaponId;
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
    secondary: 'pistol',
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
    role: 'Supresión',
    desc: 'Cargador de 80 balas. Aguanta una esquina él solo.',
  },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, Character>;
export const isCharacterId = (v: unknown): v is CharacterId => typeof v === 'string' && Object.hasOwn(CHAR_BY_ID, v);

export type SkinId =
  'base' | 'camo' | 'noche' | 'artico' | 'oro' | 'urbano' | 'desierto' | 'bosque' | 'carbono' | 'neon';

/** Skins only change the look (colours and patterns live in the client models). */
export const SKINS: { id: SkinId; name: string }[] = [
  { id: 'base', name: 'Clásico' },
  { id: 'camo', name: 'Camuflaje' },
  { id: 'noche', name: 'Nocturno' },
  { id: 'artico', name: 'Ártico' },
  { id: 'oro', name: 'Dorado' },
  { id: 'urbano', name: 'Urbano' },
  { id: 'desierto', name: 'Desierto' },
  { id: 'bosque', name: 'Bosque' },
  { id: 'carbono', name: 'Carbono' },
  { id: 'neon', name: 'Neón' },
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
  { hex: '#e0609e', name: 'Rosa' },
  { hex: '#5f6873', name: 'Grafito' },
] as const;
export type OutfitColor = (typeof OUTFIT_COLORS)[number]['hex'];
export const OUTFIT_COLOR_HEXES = OUTFIT_COLORS.map((c) => c.hex);
export const isOutfitColor = (v: unknown): v is OutfitColor => OUTFIT_COLORS.some((c) => c.hex === v);

/** Real speed of a character holding a weapon (m/s). */
export const speedWith = (c: Character, weaponId: WeaponId): number => +(c.speed * WEAPONS[weaponId].weight).toFixed(1);
