import type { ReactNode } from 'react';
import {
  ABILITIES,
  ABILITY_IDS,
  ACCESSORIES,
  ACCESSORY_IDS,
  MEDKIT_HP,
  accessoryBlock,
  type AbilityId,
  type AccessoryId,
} from '@blockshot/shared';
import { ACCESSORY_ICON, Icon } from '../ui/icons';
import type { Look } from './looks';

// Pieces of the class builder shared by the class screen («Mi clase») and the in-match loadout menu: the ability
// and accessory pickers and their icons.

/** One line per ability for the tray (the full text from shared shows on hover and in the sheet). */
export const ABILITY_LINE: Record<AbilityId, string> = {
  smoke: 'Una nube que nadie atraviesa con la vista.',
  mine: 'Estalla si un rival se acerca. Una a la vez.',
  shield: 'Para las balas de frente; disparar lo baja.',
  dash: 'Te lanza unos 7 m hacia donde te mueves.',
  wall: 'Un muro de cobertura que para balas.',
  radar: 'Marca a los rivales en el minimapa.',
  medkit: `${MEDKIT_HP} de vida de golpe, solo a cubierto.`,
};

// Line icons of the abilities (the proposal's ABILITY_ICON)
const ABILITY_SVG: Record<AbilityId, ReactNode> = {
  smoke: (
    <>
      <path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 18 18z" />
      <path d="M8 21h8" />
    </>
  ),
  mine: (
    <>
      <circle cx="12" cy="13" r="5" />
      <path d="M12 3v3M4 13H1M23 13h-3M6.3 7.3 4.2 5.2M17.7 7.3l2.1-2.1" />
    </>
  ),
  shield: <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />,
  dash: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  wall: <path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 18 6" />
    </>
  ),
  medkit: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4h6v2M12 10v6M9 13h6" />
    </>
  ),
};

export function AbilityIcon({ id }: { id: AbilityId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ABILITY_SVG[id]}
    </svg>
  );
}

export function AccessoryIcon({ id }: { id: AccessoryId }) {
  return <Icon name={ACCESSORY_ICON[id]} size={24} />;
}

/** The abilities (key E) as tiles: icon, name, cooldown and one line. */
export function AbilityGrid({ value, onPick }: { value: AbilityId; onPick: (id: AbilityId) => void }) {
  return (
    <div className="ab-grid" role="group" aria-label="Habilidad (tecla E)">
      {ABILITY_IDS.map((id) => {
        const a = ABILITIES[id];
        const on = value === id;
        return (
          <button
            key={id}
            className={`ab-opt ${on ? 'on' : ''}`}
            aria-pressed={on}
            title={a.desc}
            onClick={() => onPick(id)}
          >
            <span className="ic">
              <AbilityIcon id={id} />
            </span>
            <b>{a.name}</b>
            <em>{a.cooldownMs / 1000} s</em>
            <small>{ABILITY_LINE[id]}</small>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The accessories as tiles: icon, name, what it gives and what it costs. One the class's weapons do not take (a
 * silencer on a shotgun) is greyed out with the reason.
 */
export function AccessoryGrid({ look, onPick }: { look: Look; onPick: (id: AccessoryId) => void }) {
  return (
    <div className="ab-grid acc-grid" role="group" aria-label="Accesorio">
      {ACCESSORY_IDS.map((id) => {
        const a = ACCESSORIES[id];
        const on = look.accessory === id;
        const blocked = accessoryBlock(id, look.primary, look.secondary);
        return (
          <button
            key={id}
            className={`ab-opt acc-opt ${on ? 'on' : ''} ${blocked ? 'off' : ''}`}
            aria-pressed={on}
            aria-disabled={!!blocked}
            title={blocked ?? a.desc}
            onClick={() => !blocked && onPick(id)}
          >
            <span className="ic">
              <AccessoryIcon id={id} />
            </span>
            <b>{a.name}</b>
            <small>
              {blocked ? (
                <span className="acc-why">{blocked}</span>
              ) : (
                <>
                  {a.line} <span className="acc-cost">{a.cost}</span>
                </>
              )}
            </small>
          </button>
        );
      })}
    </div>
  );
}
