import { useEffect, useRef, useState } from 'react';
import {
  CHARACTERS,
  CHAR_BY_ID,
  SKINS,
  TEAMS,
  WEAPONS,
  canSwitchTeam,
  speedWith,
  weightName,
  type CharacterId,
  type ModeId,
  type PlayerSnapshot,
  type SideTeam,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import type { RoomView } from '../game/roomView';
import { SIDES, teamVar } from '../game/hud/teamStyle';
import CharacterPreview from './CharacterPreview';

/** Bar scales of the character sheet. */
const MAX_HP_BAR = 150;
const SPEED_BAR_MIN = 5;
const SPEED_BAR_RANGE = 5.5;

export type SkinChoice = Partial<Record<CharacterId, SkinId>>;

// Swatch of each skin: 135° diagonal with two colours
const SKIN_SWATCH: Record<SkinId, (c: string) => [string, string]> = {
  base: (c) => [c, `color-mix(in oklch, ${c} 55%, #1b2a4a)`],
  camo: () => ['#6b7a3a', '#3d4722'],
  noche: (c) => ['#16181f', c],
  artico: () => ['#eef2f6', '#9aa8b6'],
  oro: () => ['#ffd34d', '#a8780f'],
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
  players?: PlayerSnapshot[];
  onTeam: (t: SideTeam) => void;
}
function TeamPicker({ myTeam, players = [], onTeam }: TeamPickerProps) {
  const count = (t: SideTeam) => players.filter((p) => p.tm === t).length;
  return (
    <div className="team-pick">
      <span>Equipo</span>
      {SIDES.map((t) => (
        <button
          key={t}
          className={myTeam === t ? 'on' : ''}
          style={{ '--t': teamVar(t) }}
          onClick={() => myTeam !== t && onTeam(t)}
        >
          <i />
          {TEAMS[t].name}
          <small>
            {count(t)} {count(t) === 1 ? 'jugador' : 'jugadores'}
          </small>
          {myTeam === t && <em>Tu equipo</em>}
        </button>
      ))}
    </div>
  );
}

interface CharacterSelectProps {
  info: RoomView;
  current: CharacterId | null;
  skins: SkinChoice;
  respawnIn?: number;
  fromDeath: boolean;
  onPick: (id: CharacterId, skin: SkinId) => void;
  onKeep: (() => void) | null;
  onLeave: () => void;
  mode: ModeId;
  myTeam: Team;
  players: PlayerSnapshot[];
  onTeam: (t: SideTeam) => void;
}

export default function CharacterSelect({
  info,
  current,
  skins,
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
  const skin: SkinId = skinBy[sel] ?? 'base';
  const live = useRef({ sel, skin });
  live.current = { sel, skin };

  // Atajos: 1–5 elige personaje, Enter juega
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const pick = CHARACTERS[n - 1];
      if (n >= 1 && pick) setSel(pick.id);
      if (e.key === 'Enter') onPick(live.current.sel, live.current.skin);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onPick]);

  return (
    <div className="select-screen">
      <div className="stage">
        <div className="room-info">
          <b>{info.name}</b>
          <span>
            {info.map} · {info.size} · {info.players} jugando
          </span>
        </div>
        <h2 className="screen-title">Elige personaje</h2>
        {fromDeath && (
          <div className="death-chip">
            ⏱ Se aplica al reaparecer{respawnIn > 0 ? ` · ${Math.ceil(respawnIn / 1000)} s` : ''}
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
                onDoubleClick={() => onPick(ch.id, skinBy[ch.id] || 'base')}
              >
                <span className="sq" />
                <span>
                  <b>{ch.name}</b>
                  <small>{WEAPONS[ch.primary].name}</small>
                </span>
                <span className="side">
                  {fromDeath && ch.id === current && <span className="tag-sol">Actual</span>}
                  <span className="num">{i + 1}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="char-stage">
            <div className="who">
              <b>{c.name}</b>
              <small>Skin {SKINS.find((k) => k.id === skin)?.name}</small>
            </div>
            <span className="drag">↔ Arrastra para girar</span>
            <span className="peana" />
            <CharacterPreview charId={sel} skin={skin} />
            <div className="skins">
              {SKINS.map((k) => {
                const [a, b] = SKIN_SWATCH[k.id](c.color);
                return (
                  <button
                    key={k.id}
                    className={skin === k.id ? 'on' : ''}
                    onClick={() => setSkinBy({ ...skinBy, [sel]: k.id })}
                  >
                    <i style={{ background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)` }} />
                    {k.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="char-info">
            <div className="top">
              <h3>{c.name}</h3>
              <span className="role">{c.role}</span>
            </div>
            <p>{c.desc}</p>
            <div className="stat">
              <span>Vida</span>
              <div className="bar">
                <i style={{ width: `${(c.hp / MAX_HP_BAR) * 100}%` }} />
              </div>
              <b>{c.hp}</b>
            </div>
            <div
              className="stat"
              title={`Con ${WEAPONS[c.secondary].name.toLowerCase()}: ${speedWith(c, c.secondary)} m/s`}
            >
              <span>Velocidad</span>
              <div className="bar">
                <i style={{ width: `${((speedWith(c, c.primary) - SPEED_BAR_MIN) / SPEED_BAR_RANGE) * 100}%` }} />
              </div>
              <b>{speedWith(c, c.primary)}</b>
            </div>
            <WeaponCard id={c.primary} slot="Principal · 1" />
            <WeaponCard id={c.secondary} slot="Secundaria · 2" />
            <button className="btn primary lg play" onClick={() => onPick(sel, skin)}>
              Jugar como {c.name}
            </button>
          </div>
        </div>

        <div className="select-foot">
          {canSwitchTeam(mode) && myTeam ? (
            <TeamPicker myTeam={myTeam} players={players} onTeam={onTeam} />
          ) : (
            <span>
              Sala: <b>{info.name}</b>
            </span>
          )}
          {onKeep && current && (
            <button className="btn" onClick={onKeep}>
              Seguir con {CHAR_BY_ID[current].name}
            </button>
          )}
          <button className="btn ghost" onClick={onLeave}>
            Salir de la sala
          </button>
        </div>
      </div>
    </div>
  );
}
