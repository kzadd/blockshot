import {
  DEFAULT_CLASS,
  DEFAULT_OUTFIT_COLOR,
  classOf,
  isCamoId,
  isFinishId,
  isOutfitColor,
  isSkinId,
  type AbilityId,
  type AccessoryId,
  type CamoId,
  type FinishId,
  type SkinId,
  type WeaponId,
} from '@blockshot/shared';

// The player's class («Mi clase»), kept in this browser: the weapons, ability and accessory (the class) plus the
// looks (face, outfit colour, uniform camouflage, guns' finish). The lobby, the in-game class screen, the in-match
// loadout menu and the spawn all read and write it here.

export interface Look {
  skin: SkinId;
  color: string;
  camo: CamoId;
  finish: FinishId;
  primary: WeaponId;
  secondary: WeaponId;
  ability: AbilityId;
  accessory: AccessoryId;
}

/** What a new player starts from: the default class (M4, Beretta 92G, smoke, no accessory) in the default looks. */
export const DEFAULT_LOOK: Look = {
  ...DEFAULT_CLASS,
  skin: 'base',
  color: DEFAULT_OUTFIT_COLOR,
  camo: 'liso',
  finish: 'estandar',
};

const CLASS_KEY = 'blockshot:class';

/** The saved class; anything missing or no longer valid falls back to the default's. */
export function loadClass(): Look {
  let v: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(CLASS_KEY) ?? 'null') as unknown;
    if (raw && typeof raw === 'object') v = raw as Record<string, unknown>;
  } catch {
    // private mode / blocked storage / a broken value: start from the default
  }
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : null);
  return {
    ...classOf({
      primary: str('primary'),
      secondary: str('secondary'),
      ability: str('ability'),
      accessory: str('accessory'),
    }),
    skin: isSkinId(v.skin) ? v.skin : DEFAULT_LOOK.skin,
    color: isOutfitColor(v.color) ? v.color : DEFAULT_LOOK.color,
    camo: isCamoId(v.camo) ? v.camo : DEFAULT_LOOK.camo,
    finish: isFinishId(v.finish) ? v.finish : DEFAULT_LOOK.finish,
  };
}

export function saveClass(look: Look): void {
  try {
    localStorage.setItem(CLASS_KEY, JSON.stringify(look));
  } catch {
    // private mode / blocked storage: the class still works for this session
  }
}
