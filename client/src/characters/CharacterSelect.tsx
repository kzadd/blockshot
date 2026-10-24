import { useEffect, useRef, useState } from 'react';
import {
  CHARACTERS,
  CHAR_BY_ID,
  OUTFIT_COLORS,
  SKINS,
  TEAMS,
  WEAPONS,
  canSwitchTeam,
  isOutfitColor,
  isTeamMode,
  speedWith,
  weightName,
  type CharacterId,
  type ModeId,
  type SideTeam,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import type { HudPlayer } from '../game/hud/hudState';
import type { RoomView } from '../game/roomView';
import { SIDES, teamVar } from '../game/hud/teamStyle';
import { Icon } from '../ui/icons';
import CharacterPreview from './CharacterPreview';

/** Bar scales of the character sheet. */
const MAX_HP_BAR = 150;
const SPEED_BAR_MIN = 5;
const SPEED_BAR_RANGE = 5.5;

export type SkinChoice = Partial<Record<CharacterId, SkinId>>;
/** Outfit colour (hex from OUTFIT_COLORS) picked for each character. */
export type ColorChoice = Partial<Record<CharacterId, string>>;

// Swatch of each skin: 135° diagonal with two colours
const SKIN_SWATCH: Record<SkinId, (c: string) => [string, string]> = {
  base: (c) => [c, `color-mix(in oklch, ${c} 55%, #12171c)`],
  camo: () => ['#6b7a3a', '#3d4722'],
  noche: (c) => ['#16181f', c],
  artico: () => ['#eef2f6', '#9aa8b6'],
  oro: () => ['#ffd34d', '#a8780f'],
  urbano: () => ['#7a7e84', '#3c3f44'],
  desierto: () => ['#d2bc94', '#8f7450'],
  bosque: () => ['#4b5a32', '#2a2f1e'],
  carbono: (c) => ['#26282c', c],
  neon: (c) => ['#16131f', c],
};

function WeaponCard({ id, slot }: { id: WeaponId; slot: string }) {
  const w = WEAPONS[id];
  return (
    <div className="weapon-card">
      <div className="wh">
        <b>{w.name}</b>
        <small>{slot}</small>
      </div>
      <div className="wstats">
        <span>
          <b>{w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage}</b>
          <small>Daño</small>
        </span>
        <span>
          <b>{(1000 / w.fireRate).toFixed(1)}</b>
          <small>Disp./s</small>
        </span>
        <span>
          <b>{w.mag}</b>
          <small>Cargador</small>
        </span>
        <span>
          <b>{weightName(w)}</b>
          <small>Peso</small>
        </span>
      </div>
    </div>
  );
}

// Team modes: pick a team (with how many players each has)
interface TeamPickerProps {
  myTeam: Team;
  players?: HudPlayer[];
  onTeam: (t: SideTeam) => void;
}
function TeamPicker({ myTeam, players = [], onTeam }: TeamPickerProps) {
  const count = (t: SideTeam) => players.filter((p) => p.tm === t).length;
  return (
    <div className="team-pick">
      <span className="kicker">Tu equipo</span>
      <div className="seg">
        {SIDES.map((t) => (
          <button
            key={t}
            className={myTeam === t ? 'on' : ''}
            aria-pressed={myTeam === t}
            style={{ '--t': teamVar(t) }}
            onClick={() => myTeam !== t && onTeam(t)}
          >
            <b>
              <i />
              {TEAMS[t].name}
            </b>
            <small>
              {count(t)} {count(t) === 1 ? 'jugador' : 'jugadores'}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

interface CharacterSelectProps {
  info: RoomView;
  current: CharacterId | null;
  skins: SkinChoice;
  colors: ColorChoice;
  respawnIn?: number;
  fromDeath: boolean;
  onPick: (id: CharacterId, skin: SkinId, color: string) => void;
  onKeep: (() => void) | null;
  onLeave: () => void;
  mode: ModeId;
  myTeam: Team;
  players: HudPlayer[];
  onTeam: (t: SideTeam) => void;
}

export default function CharacterSelect({
  info,
  current,
  skins,
  colors,
  respawnIn = 0,
  fromDeath,
  onPick,
  onKeep,
  onLeave,
  mode,
  myTeam,
  players,
  onTeam,
}: CharacterSelectProps) {
  const [sel, setSel] = useState<CharacterId>(current ?? CHARACTERS[0]!.id);
  const [skinBy, setSkinBy] = useState(skins);
  const c = CHAR_BY_ID[sel];
  const [colorBy, setColorBy] = useState(colors);
  const skin: SkinId = skinBy[sel] ?? 'base';
  const colorOf = (id: CharacterId) => {
    const picked = colorBy[id];
    return isOutfitColor(picked) ? picked : CHAR_BY_ID[id].color;
  };
  const color = colorOf(sel);
  const live = useRef({ sel, skin, color });
  live.current = { sel, skin, color };

  // Atajos: 1–5 elige personaje, Enter juega
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const pick = CHARACTERS[n - 1];
      if (n >= 1 && pick) setSel(pick.id);
      if (e.key === 'Enter') onPick(live.current.sel, live.current.skin, live.current.color);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onPick]);

  return (
    <div className="select-screen">
      <div className="stage">
        <header className="sel-head">
          <div className="room-info">
            <b>{info.name}</b>
            <span>
              {info.map} · {info.size} · {info.players} jugando
            </span>
          </div>
          <h2 className="screen-title">Elige personaje</h2>
          <div className="sel-actions">
            {onKeep && current && (
              <button className="btn md" onClick={onKeep}>
                Seguir con {CHAR_BY_ID[current].name}
              </button>
            )}
            <button className="btn ghost danger md" onClick={onLeave}>
              <Icon name="logout" />
              Salir de la sala
            </button>
          </div>
        </header>
        {fromDeath && (
          <div className="death-chip">
            <Icon name="info" size={14} />
            Se aplica al reaparecer{respawnIn > 0 ? ` · ${Math.ceil(respawnIn / 1000)} s` : ''}
          </div>
        )}

        <div className="select-grid" style={{ '--c': c.color }}>
          <div className="char-list">
            {CHARACTERS.map((ch, i) => (
              <button
                key={ch.id}
                className={`char-card ${ch.id === sel ? 'on' : ''}`}
                style={{ '--c': ch.color }}
                onClick={() => setSel(ch.id)}
                onDoubleClick={() => onPick(ch.id, skinBy[ch.id] || 'base', colorOf(ch.id))}
              >
                <span className="sq" />
                <span className="char-card-text">
                  <b>{ch.name}</b>
                  <small>{WEAPONS[ch.primary].name}</small>
                </span>
                <span className="side">
                  {fromDeath && ch.id === current && <span className="tag-sol">Actual</span>}
                  <kbd>{i + 1}</kbd>
                </span>
              </button>
            ))}
            {canSwitchTeam(mode) && myTeam ? <TeamPicker myTeam={myTeam} players={players} onTeam={onTeam} /> : null}
          </div>

          <div className="char-stage">
            <div className="who">
              <b>{c.name}</b>
              <small>
                Skin {SKINS.find((k) => k.id === skin)?.name}
                {!isTeamMode(mode) && ` · ${OUTFIT_COLORS.find((o) => o.hex === color)?.name ?? ''}`}
              </small>
            </div>
            {/* Outfit colour: only seen in free for all (team modes wear the team colour) */}
            {!isTeamMode(mode) && (
              <div className="outfit-colors">
                {OUTFIT_COLORS.map((o) => (
                  <button
                    key={o.hex}
                    className={color === o.hex ? 'on' : ''}
                    title={o.name}
                    aria-label={`Color ${o.name}`}
                    onClick={() => setColorBy({ ...colorBy, [sel]: o.hex })}
                    style={{ background: o.hex }}
                  />
                ))}
              </div>
            )}
            <span className="drag">
              <Icon name="rotate" size={15} />
              Arrastra para girar
            </span>
            <span className="peana" />
            <CharacterPreview charId={sel} skin={skin} color={color} />
            <div className="skins">
              {SKINS.map((k) => {
                const [a, b] = SKIN_SWATCH[k.id](color);
                return (
                  <button
                    key={k.id}
                    className={skin === k.id ? 'on' : ''}
                    title={k.name}
                    aria-label={`Skin ${k.name}`}
                    aria-pressed={skin === k.id}
                    onClick={() => setSkinBy({ ...skinBy, [sel]: k.id })}
                  >
                    <i style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }} />
                    <span>{k.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="char-info">
            <div className="top">
              <h3>{c.name}</h3>
              <span className="chip-char" style={{ '--c': c.color }}>
                {c.role}
              </span>
            </div>
            <p>{c.desc}</p>
            <div className="stats">
              <span>Vida</span>
              <div className="bar">
                <i style={{ width: `${(c.hp / MAX_HP_BAR) * 100}%` }} />
              </div>
              <b>{c.hp}</b>
              <span title={`Con ${WEAPONS[c.secondary].name.toLowerCase()}: ${speedWith(c, c.secondary)} m/s`}>
                Velocidad
              </span>
              <div className="bar">
                <i style={{ width: `${((speedWith(c, c.primary) - SPEED_BAR_MIN) / SPEED_BAR_RANGE) * 100}%` }} />
              </div>
              <b>{speedWith(c, c.primary)}</b>
            </div>
            <WeaponCard id={c.primary} slot="Principal · 1" />
            <WeaponCard id={c.secondary} slot="Secundaria · 2" />
            <button className="btn primary lg play" onClick={() => onPick(sel, skin, color)}>
              Jugar como {c.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
