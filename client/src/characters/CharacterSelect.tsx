import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ABILITIES,
  ACCESSORIES,
  BODY,
  CAMOS,
  FINISHES,
  MAPS,
  MODES,
  OUTFIT_COLORS,
  SKINS,
  TEAMS,
  WEAPONS,
  canSwitchTeam,
  fitAccessory,
  isTeamMode,
  rankOf,
  speedWith,
  weightName,
  type AbilityId,
  type CamoId,
  type FinishId,
  type ModeId,
  type SideTeam,
  type SkinId,
  type Team,
  type WeaponId,
} from '@blockshot/shared';
import { RankBadge, rankInk } from '../ui/badges';
import type { HudPlayer } from '../game/hud/hudState';
import type { RoomView } from '../game/roomView';
import { SIDES, teamVar } from '../game/hud/teamStyle';
import { camoMap } from '../game/render/models';
import { blurredMap } from '../lobby/mapImage';
import CharacterPreview from './CharacterPreview';
import { AbilityGrid, AbilityIcon, AccessoryGrid, AccessoryIcon } from './ClassParts';
import Loadout, { GunPic, SLOTS, familyOf, reach, type Slot } from './Loadout';
import { loadClass, saveClass, type Look } from './looks';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

// The class screen («Mi clase»), built on the approved proposal's character screen (.impeccable/mocks/propuesta:
// #v-personaje and skinRow in proto.js), same DOM and classes so proposal.css draws it. There are no characters:
// the player builds one class (primary, secondary, ability, accessory) and dresses it. Three columns: on the left
// what to change, in two levels («Equipo» and «Aspecto», each with its tabs); the model in the middle, holding the
// gun of the tab (or the one hovered); on the right the resulting class and «Jugar». In a room, the proposal's top
// bar becomes the room's bar (name, map and mode, team, leave).

/** Ramp scales of the class sheet (10 cells). */
const SPEED_MIN = 5.5;
const SPEED_RANGE = 3.1;
/**
 * «Alcance» is the full-damage distance in metres, as on the weapon tiles; the ramp follows its square root up to
 * this many metres (so 8 m of a shotgun and 30 m of a rifle still read apart, and every sniper fills it).
 */
const RANGE_FULL_M = 120;
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

// Team modes: pick a team (with how many players each has), in the room bar
interface TeamPickerProps {
  myTeam: Team;
  players?: HudPlayer[];
  onTeam: (t: SideTeam) => void;
}
/** Your rank: the badge, its name in the tier's colour and how far the next step is. */
function RankChip({ points }: { points: number }) {
  const r = rankOf(points);
  return (
    <div className="rank-chip">
      <RankBadge points={points} size={56} />
      <div>
        <b style={{ color: rankInk(r.tier) }}>{r.label}</b>
        <span className="meta">
          {points} pts{r.next !== null ? ` · ${r.next - points} para subir` : ''}
        </span>
        <i className="rank-bar">
          <i style={{ width: `${Math.round(r.progress * 100)}%` }} />
        </i>
      </div>
    </div>
  );
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

// Two levels on the left: «Equipo» (what changes how you play: the two guns, the ability, the accessory) and
// «Aspecto» (how you look: face, outfit colour, camouflage, the guns' finish), each with its own tabs
type Group = 'equipo' | 'aspecto';
type Tab = 'primary' | 'secondary' | 'ability' | 'accessory' | 'face' | 'color' | 'camo' | 'finish';
const GROUPS: { id: Group; name: string; hint: string; tabs: [Tab, string][] }[] = [
  {
    id: 'equipo',
    name: 'Equipo',
    hint: 'Cómo juegas',
    tabs: [
      ['primary', 'Principal'],
      ['secondary', 'Secundaria'],
      ['ability', 'Habilidad'],
      ['accessory', 'Accesorio'],
    ],
  },
  {
    id: 'aspecto',
    name: 'Aspecto',
    hint: 'Cómo te ven',
    tabs: [
      ['face', 'Cara'],
      ['color', 'Color'],
      ['camo', 'Camuflaje'],
      ['finish', 'Acabado'],
    ],
  },
];
const groupOf = (t: Tab): Group => (GROUPS[0]!.tabs.some(([id]) => id === t) ? 'equipo' : 'aspecto');
const isSlot = (t: Tab): t is Slot => t === 'primary' || t === 'secondary';
/** Modes that hand out their own weapons (shared loadoutOf): the pick still saves, for the next room. */
export const FIXED_LOADOUT: Partial<Record<ModeId, string>> = {
  gungame: 'En Escalada de armas el modo reparte las armas: tu elección vale para otras partidas.',
  race: 'En Carrera de saltos solo se lleva la secundaria y el cuchillo.',
  insta: 'En Disparo único todos llevan railgun: tu elección vale para otras partidas.',
  traitor: 'En Traidores solo se lleva la secundaria y el cuchillo.',
};

interface CharacterSelectProps {
  /** the class in play (null before the first spawn) */
  current: Look | null;
  /** «Jugar» */
  onPick: (look: Look) => void;
  info: RoomView;
  mode: ModeId;
  respawnIn?: number;
  fromDeath?: boolean;
  onKeep?: (() => void) | null;
  onLeave: () => void;
  myTeam?: Team;
  players?: HudPlayer[];
  onTeam?: (t: SideTeam) => void;
  /** your rank points (none before the server sends them) */
  rankPoints?: number;
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
  rankPoints,
}: CharacterSelectProps) {
  const [look, setLook] = useState<Look>(() => current ?? loadClass());
  const [tab, setTab] = useState<Tab>('primary');
  // The last tab of each group, so switching group comes back where it was
  const [lastTab, setLastTab] = useState<Record<Group, Tab>>({ equipo: 'primary', aspecto: 'face' });
  // Which gun the model holds, and a gun being hovered (held meanwhile)
  const [held, setHeld] = useState<Slot>('primary');
  const [peek, setPeek] = useState<WeaponId | null>(null);
  // The entry flash and spin-in only play after changing the ability (it changes the kit), not on opening
  const [picked, setPicked] = useState(false);
  // A weapon that does not take the accessory (a shotgun with the silencer) takes it off: the tile says why
  const edit = (patch: Partial<Look>) =>
    setLook((l) => {
      const n = { ...l, ...patch };
      return { ...n, accessory: fitAccessory(n.accessory, n.primary, n.secondary) };
    });
  const pickAbility = (id: AbilityId) => {
    if (id === look.ability) return;
    edit({ ability: id });
    setPicked(true);
  };
  const play = (l: Look) => {
    saveClass(l);
    onPick(l);
  };
  const bgMap = useBlurredMap(info.map);
  // Team modes wear the team colour in the match, so the outfit colour is only picked in free for all
  const teamMode = isTeamMode(mode);
  const live = useRef(look);
  live.current = look;
  // Opening a gun's tab puts that gun in the model's hands
  const go = (t: Tab) => {
    setTab(t);
    setPeek(null);
    setLastTab((l) => ({ ...l, [groupOf(t)]: t }));
    if (isSlot(t)) setHeld(t);
  };
  const hold = (s: Slot) => {
    setHeld(s);
    if (isSlot(tab)) go(s);
  };

  // Atajo: Enter juega
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        saveClass(live.current);
        onPick(live.current);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onPick]);

  const ab = ABILITIES[look.ability];
  const primary = WEAPONS[look.primary];
  const inHand = look[held];
  const speed = speedWith(inHand, look.accessory);
  const range = reach(primary);
  const acc = ACCESSORIES[look.accessory];
  const group = groupOf(tab);
  const nameOf = <T extends { name: string }>(list: readonly T[], ok: (o: T) => boolean) => list.find(ok)?.name ?? '';
  const colorName = nameOf(OUTFIT_COLORS, (o) => o.hex === look.color);
  // What each tab holds now: under its name in the tab, and in the class sheet
  const value: Record<Tab, string> = {
    primary: primary.name,
    secondary: WEAPONS[look.secondary].name,
    ability: ab.name,
    accessory: acc.name,
    face: nameOf(SKINS, (k) => k.id === look.skin),
    color: colorName,
    camo: nameOf(CAMOS, (k) => k.id === look.camo),
    finish: nameOf(FINISHES, (k) => k.id === look.finish),
  };
  const tabs = GROUPS.find((g) => g.id === group)!.tabs.filter(([id]) => id !== 'color' || !teamMode);

  // The sheet's rows: the class as it goes out, each one opening its tab
  const kit: { tab: Tab; label: string; sub: string; pic: ReactNode; title?: string }[] = [
    {
      tab: 'primary',
      label: '1 · Principal',
      sub: `${familyOf(look.primary)} · ${weightName(primary).toLowerCase()}`,
      pic: <GunPic id={look.primary} look={look} />,
    },
    {
      tab: 'secondary',
      label: '2 · Secundaria',
      sub: 'Pistola',
      pic: <GunPic id={look.secondary} look={look} />,
    },
    {
      tab: 'ability',
      label: 'E · Habilidad',
      sub: `Recarga ${ab.cooldownMs / 1000} s`,
      pic: (
        <span className="ic">
          <AbilityIcon id={look.ability} />
        </span>
      ),
      title: ab.desc,
    },
    {
      tab: 'accessory',
      label: 'Accesorio',
      sub: look.accessory === 'none' ? 'Sin ventajas ni pegas' : acc.cost,
      pic: (
        <span className="ic">
          <AccessoryIcon id={look.accessory} />
        </span>
      ),
      title: acc.desc,
    },
  ];
  const looks: { tab: Tab; style: CSSProperties; face?: boolean }[] = [
    { tab: 'face', style: {}, face: true },
    ...(teamMode ? [] : [{ tab: 'color' as Tab, style: { background: look.color } }]),
    { tab: 'camo', style: camoStyle(look.color, look.camo) },
    { tab: 'finish', style: finishStyle(look.finish, look) },
  ];

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
          {rankPoints !== undefined && <RankChip points={rankPoints} />}
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
                Seguir con la clase actual
              </button>
            )}
            <button className="btn" onClick={onLeave}>
              Salir de la sala
            </button>
          </div>
        </header>

        <main className="screen chars cls cb-screen" style={{ '--cc': look.color }}>
          <section className="panel cb-build" aria-label="Construir la clase">
            <div className="cb-groups" role="group" aria-label="Qué cambiar">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  className={group === g.id ? 'on' : ''}
                  aria-pressed={group === g.id}
                  onClick={() => go(lastTab[g.id])}
                >
                  {g.name}
                  <small>{g.hint}</small>
                </button>
              ))}
            </div>
            <div className="cb-tabs" role="group" aria-label={group === 'equipo' ? 'Equipo' : 'Aspecto'}>
              {tabs.map(([id, name]) => (
                <button key={id} className={tab === id ? 'on' : ''} aria-pressed={tab === id} onClick={() => go(id)}>
                  {name}
                  <small>{value[id]}</small>
                </button>
              ))}
            </div>
            <div className="cb-body">
              {isSlot(tab) && (
                <Loadout
                  look={look}
                  slot={tab}
                  note={FIXED_LOADOUT[mode]}
                  onPeek={setPeek}
                  onPick={(slot, id) => edit({ [slot]: id })}
                />
              )}
              {tab === 'ability' && <AbilityGrid value={look.ability} onPick={pickAbility} />}
              {tab === 'accessory' && <AccessoryGrid look={look} onPick={(id) => edit({ accessory: id })} />}
              {group === 'aspecto' && (
                <div className="cb-tiles" role="group" aria-label={tabs.find(([id]) => id === tab)?.[1]}>
                  {tab === 'face' &&
                    SKINS.map((k) => (
                      <button
                        key={k.id}
                        className={`cb-tile ${look.skin === k.id ? 'on' : ''}`}
                        aria-pressed={look.skin === k.id}
                        onClick={() => edit({ skin: k.id })}
                      >
                        <span className="cb-sw face">
                          <SkinFace skin={k.id} color={look.color} />
                        </span>
                        {k.name}
                      </button>
                    ))}
                  {tab === 'color' &&
                    OUTFIT_COLORS.map((o) => (
                      <button
                        key={o.hex}
                        className={`cb-tile ${look.color === o.hex ? 'on' : ''}`}
                        aria-pressed={look.color === o.hex}
                        onClick={() => edit({ color: o.hex })}
                      >
                        <span className="cb-sw" style={{ background: o.hex }} />
                        {o.name}
                      </button>
                    ))}
                  {tab === 'camo' &&
                    CAMOS.map((k) => (
                      <button
                        key={k.id}
                        className={`cb-tile ${look.camo === k.id ? 'on' : ''}`}
                        aria-pressed={look.camo === k.id}
                        onClick={() => edit({ camo: k.id })}
                      >
                        <span className="cb-sw" style={camoStyle(look.color, k.id)} />
                        {k.name}
                      </button>
                    ))}
                  {tab === 'finish' &&
                    FINISHES.map((k) => (
                      <button
                        key={k.id}
                        className={`cb-tile ${look.finish === k.id ? 'on' : ''}`}
                        aria-pressed={look.finish === k.id}
                        onClick={() => edit({ finish: k.id })}
                      >
                        <span className="cb-sw" style={finishStyle(k.id, look)} />
                        {k.name}
                      </button>
                    ))}
                </div>
              )}
              {group === 'aspecto' && teamMode && (
                <p className="cb-note">En los modos por equipos el traje lleva el color de tu equipo.</p>
              )}
            </div>
          </section>

          <section className="stage cb-stage" aria-label="Tu personaje">
            <div className="view">
              <div key={look.ability} className={`stage-bg ${picked ? 'flash' : ''}`} />
              <CharacterPreview look={look} held={(isSlot(tab) && peek) || inHand} showcase={tab === 'finish'} />
              <div className="stage-top">
                <span className="hint">Arrastra para girar</span>
              </div>
              {tab !== 'finish' && (
                <div className="seg sm held-seg" role="group" aria-label="Arma en la mano">
                  {SLOTS.map(({ slot, key }) => (
                    <button
                      key={slot}
                      className={held === slot ? 'on' : ''}
                      aria-pressed={held === slot}
                      onClick={() => hold(slot)}
                    >
                      <kbd>{key}</kbd>
                      {WEAPONS[look[slot]].name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="panel info cb-sum">
            <div key={look.ability} className={`cb-sum-in ${picked ? 'anim' : ''}`}>
              <h1>Mi clase</h1>
              <div className="stat">
                <span>Vida</span>
                <Ramp value={BODY.hp} max={BODY.hp} />
                <b>{BODY.hp}</b>
              </div>
              <div
                className="stat"
                title={`Con ${WEAPONS[inHand].name} en la mano${look.accessory === 'kevlar' ? ' y el Kevlar' : ''}`}
              >
                <span>Velocidad</span>
                <Ramp value={speed - SPEED_MIN} max={SPEED_RANGE} />
                <b>{speed.toFixed(1)}</b>
              </div>
              <div className="stat" title={`${primary.name}: daño completo hasta ${range} m`}>
                <span>Alcance</span>
                <Ramp value={Math.sqrt(Math.min(range, RANGE_FULL_M))} max={Math.sqrt(RANGE_FULL_M)} />
                <b>{range} m</b>
              </div>
              <span className="lbl">Equipo</span>
              <ul className="cb-kit">
                {kit.map((k) => (
                  <li key={k.tab}>
                    <button
                      className={`cb-row ${tab === k.tab ? 'on' : ''}`}
                      aria-pressed={tab === k.tab}
                      title={k.title}
                      onClick={() => go(k.tab)}
                    >
                      {k.pic}
                      <span className="lbl">{k.label}</span>
                      <b>{value[k.tab]}</b>
                      <small>{k.sub}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="cb-melee">
                <span className="lbl">Cuerpo a cuerpo</span>
                Cuchillo
              </p>
              <span className="lbl">Aspecto</span>
              <div className="cb-looks" role="group" aria-label="Aspecto">
                {looks.map((l) => (
                  <button
                    key={l.tab}
                    className={tab === l.tab ? 'on' : ''}
                    aria-pressed={tab === l.tab}
                    title={`${GROUPS[1]!.tabs.find(([id]) => id === l.tab)?.[1]}: ${value[l.tab]}`}
                    aria-label={`${GROUPS[1]!.tabs.find(([id]) => id === l.tab)?.[1]}: ${value[l.tab]}`}
                    onClick={() => go(l.tab)}
                  >
                    <span className="cb-sw" style={l.style}>
                      {l.face && <SkinFace skin={look.skin} color={look.color} />}
                    </span>
                  </button>
                ))}
              </div>
              <button className="btn primary" aria-keyshortcuts="Enter" onClick={() => play(look)}>
                Jugar
                <kbd className="k" aria-hidden="true">
                  Enter
                </kbd>
              </button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
