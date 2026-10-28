import {
  CHAR_BY_ID,
  isCamoId,
  isCharacterId,
  isFinishId,
  isOutfitColor,
  isSkinId,
  type CamoId,
  type CharacterId,
  type FinishId,
  type SkinId,
} from '@blockshot/shared';

// What each player picked for each character, kept in this browser: the face (skin), the outfit colour,
// the uniform's camouflage and the guns' finish. The lobby's Personaje tab, the in-game character screen
// and the spawn all read and write it here.

export interface Look {
  skin: SkinId;
  color: string;
  camo: CamoId;
  finish: FinishId;
}

const CHAR_KEY = 'blockshot:char';
// Same keys as before for skin and colour, so earlier picks are kept
const KEYS = {
  skin: 'blockshot:skins',
  color: 'blockshot:colors',
  camo: 'blockshot:camos',
  finish: 'blockshot:finishes',
} as const;
const VALID: { [K in keyof Look]: (v: unknown) => boolean } = {
  skin: isSkinId,
  color: isOutfitColor,
  camo: isCamoId,
  finish: isFinishId,
};

const read = (key: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** The character's saved look; anything missing or no longer valid falls back to its default. */
export function lookOf(id: CharacterId): Look {
  const pick = <K extends keyof Look>(k: K, fallback: Look[K]): Look[K] => {
    const v = read(KEYS[k])[id];
    return VALID[k](v) ? (v as Look[K]) : fallback;
  };
  return {
    skin: pick('skin', 'base'),
    color: pick('color', CHAR_BY_ID[id].color),
    camo: pick('camo', 'liso'),
    finish: pick('finish', 'estandar'),
  };
}

export function saveLook(id: CharacterId, look: Look): void {
  try {
    for (const k of Object.keys(KEYS) as (keyof Look)[]) {
      localStorage.setItem(KEYS[k], JSON.stringify({ ...read(KEYS[k]), [id]: look[k] }));
    }
  } catch {
    // private mode / blocked storage: the pick still works for this session
  }
}

export function loadChar(): CharacterId | null {
  try {
    const id = localStorage.getItem(CHAR_KEY);
    return isCharacterId(id) ? id : null;
  } catch {
    return null;
  }
}

export function saveChar(id: CharacterId): void {
  try {
    localStorage.setItem(CHAR_KEY, id);
  } catch {
    // see saveLook
  }
}
