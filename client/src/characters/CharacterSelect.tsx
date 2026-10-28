import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ABILITIES,
  CAMOS,
  CHARACTERS,
  CHAR_BY_ID,
  FINISHES,
  MAPS,
  MODES,
  OUTFIT_COLORS,
  SKINS,
  TEAMS,
  WEAPONS,
  canSwitchTeam,
  isTeamMode,
  type AbilityId,
  type CamoId,
  type CharacterId,
  type FinishId,
  type ModeId,
  type SideTeam,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import type { HudPlayer } from '../game/hud/hudState';
import type { RoomView } from '../game/roomView';
import { SIDES, teamVar } from '../game/hud/teamStyle';
import { camoMap } from '../game/render/models';
import { blurredMap } from '../lobby/mapImage';
import CharacterPreview from './CharacterPreview';
import { lookOf, type Look } from './looks';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

// The character screen of the approved proposal (.impeccable/mocks/propuesta: #v-personaje, renderChars and
// skinRow in proto.js), same DOM and classes so proposal.css draws it unchanged. In a room, the proposal's
// top bar becomes the room's bar (name, map and mode, team, leave).

/** Ramp scales of the character sheet (10 cells). */
const MAX_HP = 140;
const SPEED_MIN = 5.5;
const SPEED_RANGE = 3.1;
const MAX_RANGE = 10;
/** Reach of each primary on a 1–10 scale (from the approved proposal). */
const RANGE: Partial<Record<WeaponId, number>> = {
  rifle: 6,
  sniper: 10,
  shotgun: 2,
  smg: 4,
  lmg: 6,
  dmr: 8,
  launcher: 5,
};
/** The ability's recharge bar is full at this many ms. */
const MAX_COOLDOWN_MS = 30000;
/** A team picked on the character screen shows at once; if the server never confirms, it goes back after this. */
const PENDING_TEAM_MS = 1500;

// Pixel face of each skin (8×8, "." = empty). Letters are colours; "a" is the outfit colour
export const SKIN_FACES: Record<SkinId, { rows: string[]; colors: Record<string, string> }> = {
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
  ninja: {
    rows: ['nnnnnnnn', 'aaaaaaaa', 'nnnnnnaa', 'nssssssn', 'nesnnesn', 'nnnnnnnn', 'nnnnnnnn', '.nnnnnn.'],
    colors: { n: '#2b2e38', s: '#e0b088', e: '#15171c' },
  },
  pirata: {
    rows: ['..kkkk..', 'kkkkkkkk', 'yyyyyyyy', 'ssssssss', 'kkkssess', 'kkksssss', 'hhhhhhhh', '.hhhhhh.'],
    colors: { k: '#15171c', y: '#c9a03a', s: '#e0b088', e: '#15171c', h: '#3a2a1e' },
  },
  caballero: {
    rows: ['...aa...', '..aaa...', 'mmmmmmmm', 'mmmdmmmm', 'kkkdkkkm', 'mmmdmmmm', 'mkmdmkmm', 'dddddddd'],
    colors: { m: '#b9c0c8', d: '#757d87', k: '#15171c' },
  },
  vikingo: {
    rows: ['y......y', 'yymmmmyy', 'mmmmmmmm', 'yyyyyyyy', 'skssksss', 'ssrrrsss', 'rrrrrrrr', '.rrrrrr.'],
    colors: { y: '#d9c8a0', m: '#9aa3ad', s: '#e8b894', k: '#15171c', r: '#c4652b' },
  },
  esqueleto: {
    rows: ['.wwwwww.', 'wwwwwwww', 'wkkwwkkw', 'wkawwkaw', 'wwwkkwww', '.wwwwww.', '.wkwkww.', '..wwww..'],
    colors: { w: '#ece6d4', k: '#15171c' },
  },
  panda: {
    rows: ['kk....kk', 'kwwwwwwk', 'wwwwwwww', 'kkwwwwkk', 'kewwwwek', 'wwwkkwww', 'wwwwwwww', '.wwwwww.'],
    colors: { k: '#24262b', w: '#f2f0ea', e: '#f2f0ea' },
  },
  pinguino: {
    rows: ['.kkkkkk.', 'kkkkkkkk', 'kwwkkwwk', 'kewwwwek', 'kwwyywwk', 'kwwyywwk', 'kwwwwwwk', '.kwwwwk.'],
    colors: { k: '#22262e', w: '#f4f4ee', e: '#15171c', y: '#e0a030' },
  },
  perro: {
    rows: ['.bbbbbb.', 'dbbbbbbd', 'ddddbbbd', 'ddkdbkdd', 'dbbbbbbd', 'dbbkkbbd', '.bbbbbb.', '..bbbb..'],
    colors: { b: '#d9a066', d: '#7a4a26', k: '#15171c' },
  },
  dino: {
    rows: ['..a.a.a.', '.gggggg.', 'gwkggwkg', 'gggggggg', 'gggggggg', 'gwgwgwgg', 'gggggggg', '.gggggg.'],
    colors: { g: '#6cbf4a', w: '#eee8c8', k: '#15171c' },
  },
  buho: {
    rows: ['b......b', 'bb....bb', 'bwwbbwwb', 'wyywwyyw', 'wykwwkyw', 'bwwkkwwb', 'bbbkkbbb', '.bbbbbb.'],
    colors: { b: '#8a6440', w: '#efe0bd', y: '#c9a03a', k: '#15171c' },
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

// Gun finishes as CSS swatches; camuflaje and neón depend on the look and are drawn in finishStyle
const FINISH_SW: Partial<Record<FinishId, string>> = {
  estandar: 'linear-gradient(135deg,#2b2f36 50%,#6b5040 50%)',
  acero: 'linear-gradient(135deg,#3b4047,#a3abb5 60%,#3b4047)',
  arena: '#b59a6a',
  carbono: 'repeating-linear-gradient(45deg,#17181b 0 3px,#3c4048 3px 6px)',
  damasco: 'repeating-radial-gradient(circle at 30% 120%,#3c4249 0 3px,#9aa3ad 3px 5px)',
  oro: 'linear-gradient(135deg,#a87a12,#f0cf6a 55%,#a87a12)',
  hielo: 'linear-gradient(135deg,#7fc4f2,#e8f6ff 60%,#a9dcff)',
  lava: 'radial-gradient(circle at 40% 60%,#ff6a1a 0 12%,transparent 30%),radial-gradient(circle at 75% 25%,#ff9a3a 0 8%,transparent 22%),#17110f',
};

// Camouflage swatch: the real uniform texture, drawn once per colour and pattern
const camoUrls = new Map<string, string>();
function camoStyle(color: string, camo: CamoId): CSSProperties {
  if (camo === 'liso') return { background: color };
  const key = `${color}|${camo}`;
  let url = camoUrls.get(key);
  if (!url) {
    const tex = camoMap(color, camo);
    url = (tex.image as HTMLCanvasElement).toDataURL();
    tex.dispose();
    camoUrls.set(key, url);
  }
  return { background: `url(${url}) 0 0/1.6rem`, imageRendering: 'pixelated' };
}

function finishStyle(finish: FinishId, look: Look): CSSProperties {
  if (finish === 'camuflaje') return camoStyle(look.color, look.camo === 'liso' ? 'bosque' : look.camo);
  if (finish === 'neon') return { background: `linear-gradient(135deg,#14121b 45%,${look.color} 45% 60%,#14121b 60%)` };
  return { background: FINISH_SW[finish] };
}

// The room's map behind the screen, pre-blurred (the lobby's 64×36 image, shared cache)
function useBlurredMap(mapName: string): string | undefined {
  const id = MAPS.find((m) => m.name === mapName)?.id;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    void blurredMap(id).then((u) => alive && u && setUrl(`url(${u})`));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

function Ramp({ value, max }: { value: number; max: number }) {
  const filled = Math.max(1, Math.min(10, Math.round((value / max) * 10)));
  return (
    <span className="ramp">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < filled ? 'f' : ''} />
      ))}
    </span>
  );
}

function GunCard({ id, slot }: { id: WeaponId; slot: string }) {
  const w = WEAPONS[id];
  return (
    <div className="gun">
      <div className="gun-head">
        <b>{w.name}</b>
        <span className="meta">{slot}</span>
      </div>
      <dl>
        <div>
          <dt>Daño</dt>
          <dd>{w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage}</dd>
        </div>
        <div>
          <dt>Disparos/s</dt>
          <dd>{(1000 / w.fireRate).toFixed(1)}</dd>
        </div>
        <div>
          <dt>Cargador</dt>
          <dd>{w.mag}</dd>
        </div>
      </dl>
    </div>
  );
}

// Team modes: pick a team (with how many players each has), in the room bar
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
    <div className="seg sm team-seg" role="group" aria-label="Tu equipo">
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
          <i />
          {TEAMS[t].name} · {count(t)}
        </button>
      ))}
    </div>
  );
}

type SkinTab = 'cara' | 'camo' | 'arma';
const SKIN_TABS: [SkinTab, string, number][] = [
  ['cara', 'Cara', SKINS.length],
  ['camo', 'Camuflaje', CAMOS.length],
  ['arma', 'Arma', FINISHES.length],
];

interface CharacterSelectProps {
  current: CharacterId | null;
  onPick: (id: CharacterId, look: Look) => void;
  info: RoomView;
  mode: ModeId;
  respawnIn?: number;
  fromDeath?: boolean;
  onKeep?: (() => void) | null;
  onLeave: () => void;
  myTeam?: Team;
  players?: HudPlayer[];
  onTeam?: (t: SideTeam) => void;
}

export default function CharacterSelect({
  current,
  onPick,
  info,
  mode,
  respawnIn = 0,
  fromDeath = false,
  onKeep,
  onLeave,
  myTeam,
  players,
  onTeam,
}: CharacterSelectProps) {
  const [sel, setSel] = useState<CharacterId>(current ?? CHARACTERS[0]!.id);
  const [looks, setLooks] = useState(
    () => Object.fromEntries(CHARACTERS.map((ch) => [ch.id, lookOf(ch.id)])) as Record<CharacterId, Look>,
  );
  const [tab, setTab] = useState<SkinTab>('cara');
  // The entry flash and fade-in only play after picking another character, not on opening the screen
  const [picked, setPicked] = useState(false);
  const c = CHAR_BY_ID[sel];
  const look = looks[sel];
  const edit = (patch: Partial<Look>) => setLooks((all) => ({ ...all, [sel]: { ...all[sel], ...patch } }));
  const choose = (id: CharacterId) => {
    setSel(id);
    setPicked(true);
  };
  const bgMap = useBlurredMap(info.map);
  // Team modes wear the team colour in the match, so the outfit colour is only picked in free for all
  const teamMode = isTeamMode(mode);
  const live = useRef({ sel, look });
  live.current = { sel, look };

  // Atajos: 1–7 elige personaje, Enter juega
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const pick = CHARACTERS[Number(e.key) - 1];
      if (pick) {
        setSel(pick.id);
        setPicked(true);
      }
      if (e.key === 'Enter') onPick(live.current.sel, live.current.look);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onPick]);

  const ab = ABILITIES[c.ability];
  const range = RANGE[c.primary] ?? 5;

  return (
    <div className="pz cs-window" style={{ '--bgmap': bgMap }}>
      <div className="backdrop" aria-hidden="true" />
      <div className="app">
        <header className="bar room-bar">
          <span className="logo">
            <img src="/brand/blockshot-logo-transparente.svg" alt="BLOCKSHOT" />
          </span>
          <div className="room-id">
            <b>{info.name}</b>
            <span className="meta">
              {info.map} · {MODES.find((m) => m.id === mode)?.name ?? mode}
            </span>
          </div>
          {canSwitchTeam(mode) && myTeam && onTeam ? (
            <TeamPicker myTeam={myTeam} players={players} onTeam={onTeam} />
          ) : null}
          {fromDeath && (
            <span className="chip">
              Se aplica al reaparecer{respawnIn > 0 ? ` · ${Math.ceil(respawnIn / 1000)} s` : ''}
            </span>
          )}
          <div className="room-acts">
            {onKeep && current && (
              <button className="btn" onClick={onKeep}>
                Seguir con {CHAR_BY_ID[current].name}
              </button>
            )}
            <button className="btn" onClick={onLeave}>
              Salir de la sala
            </button>
          </div>
        </header>

        <main className="screen chars" style={{ '--cc': look.color }}>
          <ol className="roster">
            {CHARACTERS.map((ch, i) => (
              <li key={ch.id}>
                <button
                  className={ch.id === sel ? 'on' : ''}
                  aria-pressed={ch.id === sel}
                  onClick={() => choose(ch.id)}
                  onDoubleClick={() => onPick(ch.id, looks[ch.id])}
                >
                  <i style={{ background: ch.id === sel ? look.color : ch.color }} />
                  <span>
                    <b>{ch.name}</b>
                    <small>{ch.role}</small>
                  </span>
                  <kbd>{i + 1}</kbd>
                </button>
              </li>
            ))}
          </ol>
          <section className="stage">
            <div className="view">
              <div key={sel} className={`stage-bg ${picked ? 'flash' : ''}`} />
              <CharacterPreview charId={sel} look={look} showcase={tab === 'arma'} />
              <div className="stage-top">
                <span className="hint">Arrastra para girar</span>
              </div>
              {!teamMode && (
                <div className="colors" role="group" aria-label="Color del traje">
                  {OUTFIT_COLORS.map((o) => (
                    <button
                      key={o.hex}
                      className={look.color === o.hex ? 'on' : ''}
                      title={o.name}
                      aria-label={o.name}
                      aria-pressed={look.color === o.hex}
                      onClick={() => edit({ color: o.hex })}
                      style={{ background: o.hex }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="skin-row">
              <div className="st-tabs">
                {SKIN_TABS.map(([id, name, n]) => (
                  <button
                    key={id}
                    className={tab === id ? 'on' : ''}
                    aria-pressed={tab === id}
                    onClick={() => setTab(id)}
                  >
                    {name}
                    <small>{n}</small>
                  </button>
                ))}
              </div>
              <div className={`st-grid ${tab === 'cara' ? 'two-rows' : ''}`}>
                {tab === 'cara' &&
                  SKINS.map((k) => (
                    <button
                      key={k.id}
                      className={`skin ${look.skin === k.id ? 'on' : ''}`}
                      aria-pressed={look.skin === k.id}
                      onClick={() => edit({ skin: k.id })}
                    >
                      <SkinFace skin={k.id} color={look.color} />
                      {k.name}
                    </button>
                  ))}
                {tab === 'camo' &&
                  CAMOS.map((k) => (
                    <button
                      key={k.id}
                      className={`skin ${look.camo === k.id ? 'on' : ''}`}
                      aria-pressed={look.camo === k.id}
                      onClick={() => edit({ camo: k.id })}
                    >
                      <i className="sw" style={camoStyle(look.color, k.id)} />
                      {k.name}
                    </button>
                  ))}
                {tab === 'arma' &&
                  FINISHES.map((k) => (
                    <button
                      key={k.id}
                      className={`skin ${look.finish === k.id ? 'on' : ''}`}
                      aria-pressed={look.finish === k.id}
                      onClick={() => edit({ finish: k.id })}
                    >
                      <i className="sw" style={finishStyle(k.id, look)} />
                      {k.name}
                    </button>
                  ))}
              </div>
            </div>
          </section>
          <aside className="panel info">
            <div
              key={sel}
              className={picked ? 'anim' : ''}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <span className="role">{c.role}</span>
              <h1>{c.name}</h1>
              <p className="desc">{c.desc}</p>
              <div className="stat">
                <span>Vida</span>
                <Ramp value={c.hp} max={MAX_HP} />
                <b>{c.hp}</b>
              </div>
              <div className="stat">
                <span>Velocidad</span>
                <Ramp value={c.speed - SPEED_MIN} max={SPEED_RANGE} />
                <b>{c.speed.toFixed(1)}</b>
              </div>
              <div className="stat">
                <span>Alcance</span>
                <Ramp value={range} max={MAX_RANGE} />
                <b>{range}</b>
              </div>
              <GunCard id={c.primary} slot="Principal · 1" />
              <GunCard id={c.secondary} slot="Secundaria · 2" />
              <div className="ability">
                <div className="ab-head">
                  <span className="ic">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {ABILITY_SVG[c.ability]}
                    </svg>
                  </span>
                  <div>
                    <span className="lbl">Habilidad</span>
                    <b>{ab.name}</b>
                  </div>
                  <kbd className="k">E</kbd>
                </div>
                <p className="meta">{ab.desc}</p>
                <div className="ab-cd">
                  <span>Recarga</span>
                  <i style={{ '--cd': `${(ab.cooldownMs / MAX_COOLDOWN_MS) * 100}%` }} />
                  <b>{ab.cooldownMs / 1000} s</b>
                </div>
              </div>
              <button className="btn primary" onClick={() => onPick(sel, look)}>
                Jugar como {c.name}
              </button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
