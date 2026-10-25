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
const MAX_HP_BAR = 140;
const SPEED_BAR_MIN = 5;
const SPEED_BAR_RANGE = 5.5;
/** A team picked on the character screen shows at once; if the server never confirms, it goes back after this. */
const PENDING_TEAM_MS = 1500;

export type SkinChoice = Partial<Record<CharacterId, SkinId>>;
/** Outfit colour (hex from OUTFIT_COLORS) picked for each character. */
export type ColorChoice = Partial<Record<CharacterId, string>>;

// Pixel face of each skin (8×8, "." = empty). Letters are colours; "a" is the outfit colour
const SKIN_FACES: Record<SkinId, { rows: string[]; colors: Record<string, string> }> = {
  base: {
    rows: ['hhhhhhhh', 'hhhhhhhh', 'ssssssss', 'seessees', 'ssssssss', 'ssssssss', 'ssmmmmss', 'ssssssss'],
    colors: { h: '#3a2a1e', s: '#e0b088', e: '#15171c', m: '#9a5a44' },
  },
  alien: {
    rows: ['a......a', '.g....g.', 'gggggggg', 'geeggeeg', 'geeggeeg', 'gggggggg', '.gggggg.', '..gggg..'],
    colors: { g: '#86d46c', e: '#15171c' },
  },
  mapache: {
    rows: ['gk....kg', 'gggggggg', 'gggggggg', 'kkkkkkkk', 'kwkkkkwk', 'gwwwwwwg', 'gwwkkwwg', 'ggwwwwgg'],
    colors: { g: '#8d9095', k: '#1d1f24', w: '#ece8df' },
  },
  robot: {
    rows: ['...d....', '...a....', 'mmmmmmmm', 'maaaaaam', 'mmmmmmmm', 'mmddddmm', 'mmddddmm', 'mmmmmmmm'],
    colors: { m: '#9aa3ad', d: '#4b5058' },
  },
  oso: {
    rows: ['bb....bb', 'blbbbblb', 'bbbbbbbb', 'bkbbbbkb', 'bbbllbbb', 'bbllllbb', 'bblkklbb', '.bbbbbb.'],
    colors: { b: '#8a5a36', l: '#d8b88a', k: '#1d1f24' },
  },
  astronauta: {
    rows: ['.wwwwww.', 'wwwwwwww', 'aaaaaaaa', 'woooooow', 'woooooow', 'woooooow', 'wwwwwwww', '.gggggg.'],
    colors: { w: '#eef1f4', o: '#d9a53a', g: '#9aa3ad' },
  },
  zombi: {
    rows: ['kkkk.kk.', 'kkkkkkkk', 'gggggggk', 'geeggkgk', 'geeggggk', 'gggggggg', 'gkwkwkgg', 'gggggggg'],
    colors: { g: '#7fa36a', k: '#1d1f24', e: '#15171c', w: '#d9d2b8' },
  },
  rana: {
    rows: ['.gg..gg.', 'gwwggwwg', 'gwkggkwg', 'gggggggg', 'gggggggg', 'kkkkkkkk', 'llllllll', '.llllll.'],
    colors: { g: '#5cb85c', w: '#f2f2ea', k: '#15171c', l: '#ece6a6' },
  },
  gato: {
    rows: ['o......o', 'oo....oo', 'okokokoo', 'okooooko', 'oooooooo', 'ooowwooo', 'oowkkwoo', '.owwwwo.'],
    colors: { o: '#e08a3c', k: '#15171c', w: '#f4e6d0' },
  },
  calabaza: {
    rows: ['...s....', '.oooooo.', 'oyyooyyo', 'oooooooo', 'oooyyooo', 'oyyyyyyo', 'ooyoyooo', '.oooooo.'],
    colors: { s: '#3f7a2a', o: '#e8781e', y: '#ffd24a' },
  },
};

function SkinFace({ skin, color }: { skin: SkinId; color: string }) {
  const { rows, colors } = SKIN_FACES[skin];
  return (
    <svg viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === 'a' ? color : colors[ch]} />
          ),
        ),
      )}
    </svg>
  );
}

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
  // Shown at once on click; the server's answer (myTeam) takes over when it arrives
  const [pending, setPending] = useState<SideTeam | null>(null);
  useEffect(() => {
    if (pending === myTeam) setPending(null);
  }, [pending, myTeam]);
  useEffect(() => {
    if (!pending) return undefined;
    const t = setTimeout(() => setPending(null), PENDING_TEAM_MS);
    return () => clearTimeout(t);
  }, [pending]);
  const shown = pending ?? myTeam;
  const count = (t: SideTeam) =>
    players.filter((p) => p.tm === t).length + (pending === t ? 1 : 0) - (pending && myTeam === t ? 1 : 0);
  return (
    <div className="team-pick">
      <span className="kicker">Tu equipo</span>
      <div className="seg">
        {SIDES.map((t) => (
          <button
            key={t}
            className={shown === t ? 'on' : ''}
            aria-pressed={shown === t}
            style={{ '--t': teamVar(t) }}
            onClick={() => {
              if (shown === t) return;
              setPending(t);
              onTeam(t);
            }}
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
                return (
                  <button
                    key={k.id}
                    className={skin === k.id ? 'on' : ''}
                    title={k.name}
                    aria-label={`Skin ${k.name}`}
                    aria-pressed={skin === k.id}
                    onClick={() => setSkinBy({ ...skinBy, [sel]: k.id })}
                  >
                    <i style={{ '--c': color }}>
                      <SkinFace skin={k.id} color={color} />
                    </i>
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
