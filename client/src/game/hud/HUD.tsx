import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  STREAK_REWARDS,
  WEAPONS,
  gunLadder,
  isTeamMode,
  teamName,
  type FlagSnapshot,
  type GameMap,
  type KillEvent,
  type ModeId,
  type Team,
} from '@blockshot/shared';
import Crosshair from '../../settings/Crosshair';
import { useSettings } from '../../settings/settingsStore';
import { hpColor } from '../render/models';
import { MODE_UI } from '../modeUi';
import type { RoomView } from '../roomView';
import type { HudPlayer } from './hudState';
import { useHud } from './hudStore';
import Minimap, { type MinimapSource } from './Minimap';
import { SIDES, TEAM_TXT, teamVar } from './teamStyle';

/** `out`: the line is fading out (its last 300 ms). */
export type FeedItem = { key: number; t: number; out?: boolean } & (
  | ({ type: 'kill' } & KillEvent)
  | { type: 'streak'; name: string; team: Team; label: string; n: number }
  | { type: 'notice'; text: string }
);

export interface KillBanner {
  key: number;
  name: string;
  head: boolean;
  label: string | undefined;
  n: number;
  reward: string | undefined;
}

const ARMOR_MAX = Object.values(STREAK_REWARDS).find((r) => r.id === 'armor')?.amount ?? 50;
const LOW_HP = 0.25;
const LOW_AMMO = 0.25;
const HEALTH_CHUNKS = 4;
const CHUNK_PIECES = 4;
const CHUNK_LIFE_MS = 1000;
const COMBO_MIN = 2;
const BAD_PING_MS = 120;
/** Crosshair fades out while the gun's own sight comes up. */
const AIM_FADE = 2.5;
const VIGNETTE_DAMAGE = 0.8;
const MS_PER_S = 1000;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / MS_PER_S));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Headshot icon in the killfeed: yellow square with two eyes
const HeadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-label="cabeza">
    <rect x="1" y="1" width="14" height="14" rx="3" fill="#ffc93c" stroke="#1b2a4a" strokeWidth="2" />
    <rect x="4.5" y="6" width="2.5" height="3" fill="#1b2a4a" />
    <rect x="9" y="6" width="2.5" height="3" fill="#1b2a4a" />
  </svg>
);

export function Feed({ feed, you, mode }: { feed: FeedItem[]; you: string; mode: ModeId }) {
  const color = (t: Team) => (isTeamMode(mode) && t ? TEAM_TXT[t] : undefined);
  return (
    <div className="feed">
      {feed.map((f) => {
        const out = f.out ? ' out' : '';
        if (f.type === 'kill') {
          const cls = f.killer === you ? ' mine' : f.victim === you ? ' died' : '';
          return (
            <div key={f.key} className={`feed-item${cls}${out}`}>
              <b style={{ color: color(f.killerTeam) }}>{f.killerName}</b>
              <span className="w">{f.weapon}</span>
              {f.head && <HeadIcon />}
              <b style={{ color: color(f.victimTeam) }}>{f.victimName}</b>
            </div>
          );
        }
        if (f.type === 'streak') {
          return (
            <div key={f.key} className={`feed-item streak${out}`}>
              🔥 <b style={{ color: color(f.team) }}>{f.name}</b>{' '}
              <span className="lbl">
                {f.label} ({f.n})
              </span>
            </div>
          );
        }
        return (
          <div key={f.key} className={`feed-item notice${out}`}>
            {f.text}
          </div>
        );
      })}
    </div>
  );
}

export function RoomInfo({ info }: { info: RoomView }) {
  const ping = useHud((h) => h.ping) ?? 0;
  return (
    <div className="room-info">
      <b>{info.name}</b>
      <span>
        {info.map} · {info.size}
      </span>
      <span>
        {info.players}/{info.max} jugando
      </span>
      {ping > 0 && <span className={ping > BAD_PING_MS ? 'bad' : ''}>{ping} ms</span>}
    </div>
  );
}

interface Chunk {
  key: string;
  left: number;
  i: number;
  dx: number;
  rot: number;
}

// Health in chunks: each quarter of the bar that is lost drops 4 little blocks
function useChunks(hp: number, maxHp: number): Chunk[] {
  const prev = useRef(hp);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  useEffect(() => {
    const before = Math.ceil((prev.current / maxHp) * HEALTH_CHUNKS);
    const after = Math.ceil((hp / maxHp) * HEALTH_CHUNKS);
    prev.current = hp;
    if (after >= before) return undefined;
    const born = Date.now();
    const add: Chunk[] = [];
    for (let q = after + 1; q <= before; q++) {
      for (let i = 0; i < CHUNK_PIECES; i++) {
        add.push({
          key: `${born}-${q}-${i}`,
          left: ((q - 0.5) / HEALTH_CHUNKS) * 100,
          i,
          dx: (i - 1.5) * 9 + (Math.random() - 0.5) * 6,
          rot: (Math.random() - 0.5) * 360,
        });
      }
    }
    setChunks((c) => [...c, ...add]);
    const t = setTimeout(() => setChunks((c) => c.filter((x) => !add.includes(x))), CHUNK_LIFE_MS);
    return () => clearTimeout(t);
  }, [hp, maxHp]);
  return chunks;
}

function Health() {
  const h = useHud((s) => ({
    hp: s.hp,
    maxHp: s.maxHp,
    charName: s.charName,
    armor: s.armor,
    stamina: s.stamina,
    staminaLow: s.staminaLow,
    sprinting: s.sprinting,
  }));
  const chunks = useChunks(h?.hp ?? 0, h?.maxHp ?? 1);
  if (!h) return null;
  const pct = Math.max(0, h.hp / h.maxHp);
  const low = pct <= LOW_HP;
  return (
    <div className={`hp ${low ? 'low' : ''}`}>
      <b className="hp-num">{h.hp}</b>
      <div className="hp-side">
        <div className="hp-labels hud-txt">
          <span>{h.charName}</span>
          <span>
            {h.armor > 0 && <span className="armor-num">🛡 {h.armor} · </span>}
            {h.maxHp} máx.
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="hpbar">
            <span className="trail" style={{ width: `${pct * 100}%` }} />
            <span className="fill" style={{ width: `${pct * 100}%`, background: hpColor(pct) }} />
            <span className="marks" />
          </div>
          {chunks.map((c) => (
            <i
              key={c.key}
              className="chunk"
              style={{
                left: `calc(${c.left}% - 3px)`,
                top: 6,
                animationDelay: `${c.i * 30}ms`,
                '--dx': `${c.dx}px`,
                '--rot': `${c.rot}deg`,
              }}
            />
          ))}
        </div>
        {/* Streak armor: spent before health */}
        {h.armor > 0 && (
          <div className="armor" title={`Blindaje ${h.armor}`}>
            <i style={{ width: `${Math.min(1, h.armor / ARMOR_MAX) * 100}%` }} />
          </div>
        )}
        {/* Sprint stamina (Shift), only when enabled: dims when full; orange when exhausted */}
        {h.stamina != null && (
          <div
            className={`stamina ${h.stamina < 0.99 || h.sprinting ? 'on' : ''} ${h.staminaLow ? 'empty' : ''}`}
            title="Estamina"
          >
            <i style={{ width: `${h.stamina * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Ammo() {
  const h = useHud((s) => ({
    weaponName: s.weaponName,
    mag: s.mag ?? 0,
    magSize: s.magSize ?? 0,
    reloading: s.reloading,
    reloadPct: s.reloadPct,
    slot: s.slot,
    loadout: s.loadout,
    melee: s.melee,
    gunLevel: s.gunLevel,
    gunTotal: s.gunTotal,
    scoped: s.scoped,
  }));
  if (!h) return null;
  const low = h.mag > 0 && h.mag <= h.magSize * LOW_AMMO;
  return (
    <div className="ammo">
      <span className="hud-txt" style={{ fontSize: 14 }}>
        {h.gunLevel ? `Arma ${h.gunLevel}/${h.gunTotal} · ` : ''}
        {h.weaponName}
      </span>
      {h.reloading ? (
        <div className="reloading">
          <b>Recargando</b>
          <div className="pbar">
            <i style={{ width: `${h.reloadPct * 100}%`, transition: 'none' }} />
          </div>
        </div>
      ) : h.melee ? (
        <div className="count">
          <b>🔪</b>
        </div>
      ) : (
        <div className={`count ${h.mag === 0 ? 'empty' : low ? 'low' : ''}`}>
          <b>{h.mag}</b>
          <small>/{h.magSize}</small>
        </div>
      )}
      {!h.scoped && (
        <div className="slots">
          {h.loadout.map((n, i) => (
            <span key={n + i} className={h.slot === i ? 'on' : ''}>
              <em>{i + 1}</em>
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Capture the flag: where each team's flag is
function flagStatus(f: FlagSnapshot | undefined, players: HudPlayer[], you: string): string {
  if (!f) return '';
  if (f.h) return '🚩 En su base';
  if (!f.c) return '🚩 En el suelo';
  if (f.c === you) return '🚩 ¡La llevas tú!';
  return `🚩 La lleva ${players.find((p) => p.id === f.c)?.n ?? '…'}`;
}

function TopCenter({ mode, scoreLimit, you }: { mode: ModeId; scoreLimit: number; you: string }) {
  const h = useHud((s) => ({
    players: s.players,
    myTeam: s.myTeam,
    infect: s.infect,
    teamScore: s.teamScore,
    flags: s.flags,
  }));
  if (!h) return null;
  const players = h.players;
  const top = MODE_UI[mode].top;
  if (top === 'infect') {
    // Infected: how many are left on each side and the time left (or until the first infected)
    const count = (t: Team) => players.filter((p) => p.tm === t).length;
    const inf = h.infect;
    const status =
      !inf || inf.t < 0
        ? 'Esperando a otro jugador…'
        : inf.st
          ? clock(inf.t)
          : `Infección en ${Math.ceil(inf.t / MS_PER_S)} s`;
    return (
      <div className="infect-bar">
        <span className="sv">
          {count(1)} {count(1) === 1 ? 'superviviente' : 'supervivientes'}
          {h.myTeam === 1 ? ' · TÚ' : ''}
        </span>
        <span className="sep" />
        <span className="clock">{status}</span>
        <span className="sep" />
        <span className="iz">
          {count(2)} {count(2) === 1 ? 'infectado' : 'infectados'}
          {h.myTeam === 2 ? ' · TÚ' : ''}
        </span>
      </div>
    );
  }
  const teamScore = h.teamScore;
  if (top === 'teams' && teamScore) {
    return (
      <div className="team-score">
        {SIDES.map((t) => (
          <div
            key={t}
            className={`ts ${h.myTeam === t ? 'mine' : ''}`}
            style={{ '--t': teamVar(t), '--tt': TEAM_TXT[t] }}
          >
            <small>
              {teamName(mode, t).toUpperCase()}
              {h.myTeam === t ? ' · TÚ' : ''}
            </small>
            <b>{teamScore[t]}</b>
            <span className="bar">
              <i style={{ width: `${(teamScore[t] / scoreLimit) * 100}%` }} />
            </span>
            {h.flags && <span className="flag-st">{flagStatus(h.flags[t], players, you)}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (top === 'ladder') {
    // Gun game: who is highest on the ladder
    const ladder = gunLadder(scoreLimit);
    const sorted = [...players].sort((a, b) => b.lv - a.lv || b.k - a.k);
    const top = sorted[0];
    if (!top) return null;
    const pos = sorted.findIndex((p) => p.id === you) + 1;
    const me = sorted[pos - 1];
    const gun = (p: HudPlayer) =>
      `${WEAPONS[ladder[Math.min(p.lv, ladder.length - 1)]!].name} (${p.lv + 1}/${ladder.length})`;
    return (
      <div className="leader">
        <span className="first">
          1º {pos === 1 ? 'Tú' : top.n} · {gun(top)}
        </span>
        <span className="sep" />
        <span>{pos === 1 && me ? `Tú · ${gun(me)}` : `Tú ${pos}º · ${me ? gun(me) : ''}`}</span>
      </div>
    );
  }
  // Leader pill (free for all)
  const sorted = [...players].sort((a, b) => b.k - a.k || a.d - b.d);
  const first = sorted[0];
  if (!first) return null;
  const pos = sorted.findIndex((p) => p.id === you) + 1;
  const me = sorted[pos - 1];
  const second = sorted[1];
  // When you lead, the right side shows who follows you
  const right =
    pos === 1
      ? second
        ? `2º ${second.n} · ${second.k}`
        : `Tú · ${me?.k ?? 0}/${scoreLimit}`
      : `Tú ${pos}º · ${me?.k ?? 0}/${scoreLimit}`;
  return (
    <div className="leader">
      <span className="first">
        1º {pos === 1 ? 'Tú' : first.n} · {first.k}
        {pos === 1 ? `/${scoreLimit}` : ''}
      </span>
      <span className="sep" />
      <span>{right}</span>
    </div>
  );
}

function Vignette() {
  const h = useHud((s) => ({ low: s.hp / s.maxHp <= LOW_HP, damage: s.damage }));
  if (!h) return null;
  return (
    <div
      className={`vignette ${h.low ? 'low' : ''}`}
      style={h.low ? undefined : { opacity: Math.min(1, h.damage * VIGNETTE_DAMAGE) }}
    />
  );
}

function Scope() {
  return (
    <div className="scope">
      <div className="ring" />
      <i className="h" />
      <i className="v" />
      <i className="h thick" />
      <i className="h thick r" />
      <i className="v thick" />
      <i className="dot" />
      <span className="scope-hint">Clic der. para salir · el resto del HUD se oculta mientras apuntas</span>
    </div>
  );
}

function AimCrosshair() {
  const settings = useSettings();
  const h = useHud((s) => ({ aim: s.aim, spread: s.spread, shotKey: s.shotKey }));
  if (!h) return null;
  // While aiming the gun's own sight is used (red dot or iron sight): the crosshair fades
  return (
    <div style={{ opacity: Math.max(0, 1 - h.aim * AIM_FADE), transition: 'opacity 80ms' }}>
      <Crosshair key={h.shotKey} cfg={settings.crosshair} spread={h.spread} className="crosshair kick" />
    </div>
  );
}

function CenterMarks() {
  const h = useHud((s) => ({
    hitKey: s.hitKey,
    hitMark: s.hitMark,
    hitRed: s.hitRed,
    dmgDirs: s.dmgDirs,
    ticks: s.ticks,
    combo: s.combo,
    comboKey: s.comboKey,
  }));
  if (!h) return null;
  return (
    <div className="center">
      {h.hitMark && (
        <div key={h.hitKey} className={`hitmark ${h.hitRed ? 'red' : ''}`}>
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      {h.dmgDirs.map((d) => (
        <div key={d.key} className="dmg-dir" style={{ transform: `rotate(${d.angle}rad)`, opacity: d.life }}>
          <i />
        </div>
      ))}
      {h.ticks.map((t) => (
        <div key={t.key} className="tick" style={{ transform: `rotate(${t.angle}rad)` }}>
          {[-14, 0, 14].map((dx) => (
            <i
              key={dx}
              style={{
                left: dx - 4,
                top: -168 + Math.abs(dx) * 0.2,
                height: dx === 0 ? 14 : 9,
                background: t.color,
              }}
            />
          ))}
        </div>
      ))}
      {h.combo >= COMBO_MIN && (
        <span key={h.comboKey} className="combo">
          ×{h.combo}
        </span>
      )}
    </div>
  );
}

function Banner({ banner }: { banner: KillBanner | null }) {
  if (!banner) return null;
  return (
    <div className="kill-banner" key={banner.key}>
      <span className="line1">
        Eliminaste a <span className="v">{banner.name}</span>
        {banner.head && <span className="h"> · cabeza</span>}
      </span>
      {banner.label && (
        <span className="line2">
          🔥 {banner.label} · {banner.n} seguidas
        </span>
      )}
      {banner.reward && <span className="line2">🎁 {banner.reward}</span>}
    </div>
  );
}

function CarryingFlag({ you }: { you: string }) {
  const h = useHud((s) => ({
    carrying: !!s.myTeam && s.flags?.[s.myTeam === 1 ? 2 : 1]?.c === you,
    ownHome: !!s.myTeam && !!s.flags?.[s.myTeam]?.h,
  }));
  if (!h?.carrying) return null;
  return (
    <div className="ctf-carry">
      🚩 Llevas la bandera
      <small>{h.ownHome ? 'Llévala a tu base' : 'Tu bandera no está en tu base: recupérala para capturar'}</small>
    </div>
  );
}

function SpawnProtection() {
  const seconds = useHud((s) => Math.ceil(s.protect / MS_PER_S)) ?? 0;
  if (seconds <= 0) return null;
  return (
    <div className="spawn-prot">
      🛡 Protegido {seconds} s<small>Disparar quita la protección</small>
    </div>
  );
}

interface HudProps {
  info: RoomView;
  engine: RefObject<MinimapSource | null>;
  map: GameMap;
  mode: ModeId;
  scoreLimit: number;
  you: string;
  feed: FeedItem[];
  banner: KillBanner | null;
}

export default function HUD({ info, engine, map, mode, scoreLimit, you, feed, banner }: HudProps) {
  const h = useHud((s) => ({ alive: s.alive, scoped: s.alive && s.scoped, radar: s.radar }));
  if (!h) return null;
  const { alive, scoped } = h;
  return (
    <div className="hud stage">
      {!scoped && <RoomInfo info={info} />}
      {alive && !scoped && <Minimap engine={engine} map={map} radar={h.radar} />}
      {alive && !scoped && <TopCenter mode={mode} scoreLimit={scoreLimit} you={you} />}
      {!scoped && <Feed feed={feed} you={you} mode={mode} />}

      {alive && (
        <>
          <Vignette />
          {scoped ? (
            <Scope />
          ) : (
            <>
              <AimCrosshair />
              <CenterMarks />
              <Banner banner={banner} />
            </>
          )}
          {!scoped && <CarryingFlag you={you} />}
          {!scoped && <SpawnProtection />}
          <Health />
          <Ammo />
        </>
      )}
    </div>
  );
}
