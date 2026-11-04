import { useState, type CSSProperties, type ReactNode } from 'react';
import { ABILITIES, ACCESSORIES, WEAPONS, fitAccessory, type ModeId } from '@blockshot/shared';
import { FIXED_LOADOUT } from '../../characters/CharacterSelect';
import { AbilityGrid, AbilityIcon, AccessoryGrid, AccessoryIcon } from '../../characters/ClassParts';
import Loadout, { GunPic, familyOf } from '../../characters/Loadout';
import type { Look } from '../../characters/looks';
import '../../styles/proposal.css';
import '../../styles/pz-extra.css';

// The in-match loadout menu (L), like Urban Terror's gear menu: four big tiles (primary, secondary, ability,
// accessory) over the game and, under the one picked, the same options as the class screen. The looks stay as
// they are. Saving keeps the class for the next respawn (the server takes it then, whoever respawns the player).

type Part = 'primary' | 'secondary' | 'ability' | 'accessory';

interface Props {
  /** the class in play (looks included) */
  current: Look;
  mode: ModeId;
  /** alive: the change waits for the next death; dead: the coming spawn */
  alive: boolean;
  onSave: (look: Look) => void;
  onClose: () => void;
}

export default function LoadoutMenu({ current, mode, alive, onSave, onClose }: Props) {
  const [look, setLook] = useState<Look>(current);
  const [part, setPart] = useState<Part>('primary');
  const edit = (patch: Partial<Look>) =>
    setLook((l) => {
      const n = { ...l, ...patch };
      return { ...n, accessory: fitAccessory(n.accessory, n.primary, n.secondary) };
    });
  const changed = (['primary', 'secondary', 'ability', 'accessory'] as const).some((k) => look[k] !== current[k]);
  const tiles: { part: Part; label: string; name: string; sub: string; pic: ReactNode }[] = [
    {
      part: 'primary',
      label: '1 · Principal',
      name: WEAPONS[look.primary].name,
      sub: familyOf(look.primary),
      pic: <GunPic id={look.primary} look={look} />,
    },
    {
      part: 'secondary',
      label: '2 · Secundaria',
      name: WEAPONS[look.secondary].name,
      sub: 'Pistola',
      pic: <GunPic id={look.secondary} look={look} />,
    },
    {
      part: 'ability',
      label: 'E · Habilidad',
      name: ABILITIES[look.ability].name,
      sub: `Recarga ${ABILITIES[look.ability].cooldownMs / 1000} s`,
      pic: (
        <span className="ic">
          <AbilityIcon id={look.ability} />
        </span>
      ),
    },
    {
      part: 'accessory',
      label: 'Accesorio',
      name: ACCESSORIES[look.accessory].name,
      sub: look.accessory === 'none' ? 'Sin accesorio' : ACCESSORIES[look.accessory].cost,
      pic: (
        <span className="ic">
          <AccessoryIcon id={look.accessory} />
        </span>
      ),
    },
  ];
  return (
    <div className="pz pz-layer dim gear-layer" style={{ '--cc': look.color } as CSSProperties}>
      <div className="gear-panel" role="dialog" aria-modal="true" aria-labelledby="gearTitle">
        <header className="gear-head">
          <h2 id="gearTitle">Equipo</h2>
          <span className="chip">Se aplica al reaparecer{alive ? '' : ' · en el próximo spawn'}</span>
          <span className="gear-keys">
            <kbd className="k">L</kbd>
            <kbd className="k">Esc</kbd>
            cerrar
          </span>
        </header>
        {FIXED_LOADOUT[mode] && <p className="ld-note gear-note">{FIXED_LOADOUT[mode]}</p>}
        <div className="gear-tiles" role="tablist" aria-label="Parte de la clase">
          {tiles.map((t) => (
            <button
              key={t.part}
              role="tab"
              aria-selected={part === t.part}
              className={`gear-tile ${part === t.part ? 'on' : ''}`}
              onClick={() => setPart(t.part)}
            >
              <span className="lbl">{t.label}</span>
              {t.pic}
              <b>{t.name}</b>
              <small>{t.sub}</small>
            </button>
          ))}
        </div>
        <div className="gear-body" role="tabpanel">
          {(part === 'primary' || part === 'secondary') && (
            <Loadout look={look} slot={part} onPeek={() => undefined} onPick={(slot, id) => edit({ [slot]: id })} />
          )}
          {part === 'ability' && <AbilityGrid value={look.ability} onPick={(id) => edit({ ability: id })} />}
          {part === 'accessory' && <AccessoryGrid look={look} onPick={(id) => edit({ accessory: id })} />}
        </div>
        <footer className="gear-foot">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!changed} onClick={() => onSave(look)}>
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}
