import { CHAR_BY_ID, WEAPONS, loadoutOf, type Weapon, type WeaponId } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import type { Player } from './player';

/** Gives the player its weapons for the mode (in gun game, for its level) with full magazines. */
export function equip(room: Room, p: Player): void {
  if (!p.characterId) return;
  p.loadout = loadoutOf(room.modeId, CHAR_BY_ID[p.characterId], p.level, room.scoreLimit, p.team);
  p.ammo = p.loadout.map((id) => ({ mag: WEAPONS[id].mag, reloadEnd: 0 }));
  p.lastShot = p.loadout.map(() => 0);
  p.slot = 0;
}

export const weaponIdOf = (p: Player, slot = p.slot): WeaponId | null => p.loadout[slot] ?? null;
export const weaponOf = (p: Player): Weapon | null => {
  const id = weaponIdOf(p);
  return id ? WEAPONS[id] : null;
};
