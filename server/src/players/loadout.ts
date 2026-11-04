import { WEAPONS, gearedWeapon, loadoutOf, type Weapon, type WeaponId } from '@blockshot/shared';
import type { Room } from '../rooms/room';
import type { Player } from './player';

/** Gives the player its weapons for the mode (in gun game, for its level) with full magazines. */
export function equip(room: Room, p: Player): void {
  if (!p.cls) return;
  p.loadout = loadoutOf(room.modeId, p.cls, p.level, room.scoreLimit, p.team);
  p.ammo = p.loadout.map((id) => ({ mag: gearedWeapon(id, p.cls?.accessory).mag, reloadEnd: 0 }));
  p.lastShot = p.loadout.map(() => 0);
  p.slot = 0;
  p.power = null;
}

/** A power weapon picked up: it goes after the normal weapons, full, and straight into the hands. */
export function givePower(p: Player, id: WeaponId): void {
  if (p.power) dropPower(p);
  p.power = id;
  p.loadout.push(id);
  p.ammo.push({ mag: WEAPONS[id].mag, reloadEnd: 0 });
  p.lastShot.push(0);
  p.slot = p.loadout.length - 1;
}

/** The power weapon is spent: it leaves the loadout and the first weapon comes back to the hands. */
export function dropPower(p: Player): void {
  if (!p.power) return;
  p.loadout.pop();
  p.ammo.pop();
  p.lastShot.pop();
  p.power = null;
  if (p.slot >= p.loadout.length) p.slot = 0;
}

export const weaponIdOf = (p: Player, slot = p.slot): WeaponId | null => p.loadout[slot] ?? null;
/** The weapon in hand as the player carries it: with the class's accessory (silencer, laser, extra ammo). */
export const weaponOf = (p: Player): Weapon | null => {
  const id = weaponIdOf(p);
  return id ? gearedWeapon(id, p.cls?.accessory) : null;
};
