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
    hp: 150,
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
    hp: 85,
    speed: 10.4,
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
export const isCharacterId = (v: unknown): v is CharacterId => typeof v === 'string' && v in CHAR_BY_ID;

export type SkinId = 'base' | 'camo' | 'noche' | 'artico' | 'oro';

/** Skins only change the look (colours and patterns live in the client models). */
export const SKINS: { id: SkinId; name: string }[] = [
  { id: 'base', name: 'Clásico' },
  { id: 'camo', name: 'Camuflaje' },
  { id: 'noche', name: 'Nocturno' },
  { id: 'artico', name: 'Ártico' },
  { id: 'oro', name: 'Dorado' },
];
export const isSkinId = (v: unknown): v is SkinId => SKINS.some((k) => k.id === v);

/** Real speed of a character holding a weapon (m/s). */
export const speedWith = (c: Character, weaponId: WeaponId): number => +(c.speed * WEAPONS[weaponId].weight).toFixed(1);
