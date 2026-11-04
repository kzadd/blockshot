import { useEffect, useState, type CSSProperties } from 'react';
import { PRIMARY_FAMILIES, PRIMARIES, SIDEARMS, WEAPONS, type Weapon, type WeaponId } from '@blockshot/shared';
import type { GunLook } from '../game/render/gunAssets';
import { gunThumb } from './gunThumbs';
import type { Look } from './looks';

// The weapons picker of the class screen and the in-match loadout menu: one slot at a time. The primaries come
// in families (a chip per family, the one of the chosen gun open first) and each option is a row with the gun's
// picture and name and its four numbers in aligned columns, so the guns of a family compare down the columns. The
// bars compare with the best of the whole slot (the longest bar is the best primary or the best pistol).

export type Slot = 'primary' | 'secondary';

/** Distance (m) up to which the gun does full damage; guns without falloff reach their whole range. */
export const reach = (w: Weapon): number => w.falloff?.[0] ?? w.range;

const STATS: { name: string; value: (w: Weapon) => number; text: (w: Weapon) => string }[] = [
  {
    name: 'Daño',
    value: (w) => w.damage * w.pellets,
    text: (w) => (w.pellets > 1 ? `${w.damage}×${w.pellets}` : `${w.damage}`),
  },
  { name: 'Cadencia', value: (w) => 1000 / w.fireRate, text: (w) => `${(1000 / w.fireRate).toFixed(1)}/s` },
  { name: 'Cargador', value: (w) => w.mag, text: (w) => `${w.mag}` },
  { name: 'Alcance', value: reach, text: (w) => `${reach(w)} m` },
];
/** The shortest bar still shows (fraction of the slot's best). */
const MIN_BAR = 0.08;

export const SLOTS: { slot: Slot; name: string; key: string }[] = [
  { slot: 'primary', name: 'Principal', key: '1' },
  { slot: 'secondary', name: 'Secundaria', key: '2' },
];

/** What each slot offers, in groups (the secondary is one group, shown without a chip). */
const GROUPS: Record<Slot, { name: string; weapons: WeaponId[] }[]> = {
  primary: PRIMARY_FAMILIES,
  secondary: [{ name: 'Pistolas', weapons: SIDEARMS }],
};
/** The best value of each stat in each slot, for the bars. */
const BEST: Record<Slot, number[]> = {
  primary: STATS.map((s) => Math.max(...PRIMARIES.map((o) => s.value(WEAPONS[o])))),
  secondary: STATS.map((s) => Math.max(...SIDEARMS.map((o) => s.value(WEAPONS[o])))),
};

/** The family a primary belongs to («Fusiles», «Precisión»…). */
export const familyOf = (id: WeaponId): string => PRIMARY_FAMILIES.find((f) => f.weapons.includes(id))?.name ?? '';

export function GunPic({ id, look }: { id: WeaponId; look: GunLook }) {
  const [url, setUrl] = useState<string>();
  const { finish, color, camo } = look;
  useEffect(() => {
    let alive = true;
    gunThumb(id, { finish, color, camo }).then(
      (u) => alive && setUrl(u),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [id, finish, color, camo]);
  return <span className="ld-pic">{url && <img src={url} alt="" loading="lazy" />}</span>;
}

interface LoadoutProps {
  look: Look;
  /** the slot shown */
  slot: Slot;
  onPick: (slot: Slot, id: WeaponId) => void;
  /** a gun being hovered or focused (the model holds it meanwhile), null when it leaves */
  onPeek: (id: WeaponId | null) => void;
  /** shown above the options when the room's mode hands out its own weapons */
  note?: string;
}

export default function Loadout({ look, slot, onPick, onPeek, note }: LoadoutProps) {
  const chosen = look[slot];
  const groups = GROUPS[slot];
  // The family open in the primary slot: the chosen gun's at first
  const [family, setFamily] = useState(() => familyOf(look.primary) || groups[0]!.name);
  const group = (slot === 'primary' && groups.find((g) => g.name === family)) || groups[0]!;
  const best = BEST[slot];
  const label = `Arma ${slot === 'primary' ? 'principal' : 'secundaria'}`;

  return (
    <div className="ld">
      {note && <p className="ld-note">{note}</p>}
      {slot === 'primary' && (
        <div className="ld-fams" role="group" aria-label="Familia">
          {groups.map((g) => (
            <button
              key={g.name}
              className={`ld-fam ${g === group ? 'on' : ''} ${g.weapons.includes(chosen) ? 'has' : ''}`}
              aria-pressed={g === group}
              title={g.weapons.includes(chosen) ? `${g.name}: aquí está tu ${WEAPONS[chosen].name}` : undefined}
              onClick={() => setFamily(g.name)}
            >
              {g.name}
              <small>{g.weapons.length}</small>
            </button>
          ))}
        </div>
      )}
      <div className="ld-list" role="group" aria-label={label}>
        <div className="ld-head" aria-hidden="true">
          <span>{slot === 'primary' ? group.name : 'Pistolas'}</span>
          {STATS.map((s) => (
            <span key={s.name}>{s.name}</span>
          ))}
        </div>
        {group.weapons.map((id) => {
          const w = WEAPONS[id];
          const on = chosen === id;
          return (
            <button
              key={id}
              className={`ld-opt ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => onPick(slot, id)}
              onMouseEnter={() => onPeek(id)}
              onMouseLeave={() => onPeek(null)}
              onFocus={() => onPeek(id)}
              onBlur={() => onPeek(null)}
            >
              <span className="ld-id">
                <GunPic id={id} look={look} />
                <b>{w.name}</b>
              </span>
              {STATS.map((s, i) => {
                const v = s.value(w);
                const top = group.weapons.length > 1 && v >= best[i]! - 1e-9;
                return (
                  <span key={s.name} className={`ld-stat ${top ? 'top' : ''}`}>
                    <span className="vh">{s.name}: </span>
                    <em>{s.text(w)}</em>
                    <i style={{ '--v': Math.max(MIN_BAR, v / best[i]!) } as CSSProperties} />
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
