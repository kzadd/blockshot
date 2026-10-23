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
  type PlayerSnapshot,
  type Team,
} from '@blockshot/shared';
import Crosshair from '../../settings/Crosshair';
import { useSettings } from '../../settings/settingsStore';
import { hpColor } from '../render/models';
import type { RoomView } from '../roomView';
import type { HudState } from './hudState';
import Minimap, { type MinimapSource } from './Minimap';
import { SIDES, TEAM_TXT, teamVar } from './teamStyle';

export type FeedItem = { key: number; t: number } & (
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

/** Killfeed lines start fading this long after they appear (they last 6 s). */
const FEED_FADE_AT_MS = 5700;
const ARMOR_MAX = Object.values(STREAK_REWARDS).find((r) => r.id === 'armor')?.amount ?? 50;
const LOW_HP = 0.25;
const LOW_AMMO = 0.25;
const HEALTH_CHUNKS = 4;
const CHUNK_PIECES = 4;
const CHUNK_LIFE_MS = 1000;
const HITMARK_MS = 300;
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
  const now = Date.now();
  return (
    <div className="feed">
      {feed.map((f) => {
        const out = now - f.t > FEED_FADE_AT_MS ? ' out' : '';
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

export function RoomInfo({ info, ping }: { info: RoomView; ping: number }) {
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

function Health({ hud }: { hud: HudState }) {
  const pct = Math.max(0, hud.hp / hud.maxHp);
  const low = pct <= LOW_HP;
  const chunks = useChunks(hud.hp, hud.maxHp);
  return (
    <div className={`hp ${low ? 'low' : ''}`}>
      <b className="hp-num">{hud.hp}</b>
      <div className="hp-side">
        <div className="hp-labels hud-txt">
          <span>{hud.charName}</span>
          <span>
            {hud.armor > 0 && <span className="armor-num">🛡 {hud.armor} · </span>}
            {hud.maxHp} máx.
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
        {hud.armor > 0 && (
          <div className="armor" title={`Blindaje ${hud.armor}`}>
            <i style={{ width: `${Math.min(1, hud.armor / ARMOR_MAX) * 100}%` }} />
          </div>
        )}
        {/* Sprint stamina (Shift), only when enabled: dims when full; orange when exhausted */}
        {hud.stamina != null && (
          <div
            className={`stamina ${hud.stamina < 0.99 || hud.sprinting ? 'on' : ''} ${hud.staminaLow ? 'empty' : ''}`}
            title="Estamina"
          >
            <i style={{ width: `${hud.stamina * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Ammo({ hud }: { hud: HudState }) {
  const mag = hud.mag ?? 0;
  const magSize = hud.magSize ?? 0;
  const low = mag > 0 && mag <= magSize * LOW_AMMO;
  return (
    <div className="ammo">
      <span className="hud-txt" style={{ fontSize: 14 }}>
        {hud.gunLevel ? `Arma ${hud.gunLevel}/${hud.gunTotal} · ` : ''}
        {hud.weaponName}
      </span>
      {hud.reloading ? (
        <div className="reloading">
          <b>Recargando</b>
          <div className="pbar">
            <i style={{ width: `${hud.reloadPct * 100}%`, transition: 'none' }} />
          </div>
        </div>
      ) : hud.melee ? (
        <div className="count">
          <b>🔪</b>
        </div>
      ) : (
        <div className={`count ${mag === 0 ? 'empty' : low ? 'low' : ''}`}>
          <b>{mag}</b>
          <small>/{magSize}</small>
        </div>
      )}
      {!hud.scoped && (
        <div className="slots">
          {hud.loadout.map((n, i) => (
            <span key={n + i} className={hud.slot === i ? 'on' : ''}>
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
function flagStatus(f: FlagSnapshot | undefined, players: PlayerSnapshot[], you: string): string {
  if (!f) return '';
  if (f.h) return '🚩 En su base';
  if (!f.c) return '🚩 En el suelo';
  if (f.c === you) return '🚩 ¡La llevas tú!';
  return `🚩 La lleva ${players.find((p) => p.id === f.c)?.n ?? '…'}`;
}

interface TopProps {
  hud: HudState;
  mode: ModeId;
  scoreLimit: number;
  you: string;
}

function TopCenter({ hud, mode, scoreLimit, you }: TopProps) {
  const players = hud.players;
  if (mode === 'infect') {
    // Infected: how many are left on each side and the time left (or until the first infected)
    const count = (t: Team) => players.filter((p) => p.tm === t).length;
    const inf = hud.infect;
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
          {hud.myTeam === 1 ? ' · TÚ' : ''}
        </span>
        <span className="sep" />
        <span className="clock">{status}</span>
        <span className="sep" />
        <span className="iz">
          {count(2)} {count(2) === 1 ? 'infectado' : 'infectados'}
          {hud.myTeam === 2 ? ' · TÚ' : ''}
        </span>
      </div>
    );
  }
  const teamScore = hud.teamScore;
  if (isTeamMode(mode) && teamScore) {
    return (
      <div className="team-score">
        {SIDES.map((t) => (
          <div
            key={t}
            className={`ts ${hud.myTeam === t ? 'mine' : ''}`}
            style={{ '--t': teamVar(t), '--tt': TEAM_TXT[t] }}
          >
            <small>
              {teamName(mode, t).toUpperCase()}
              {hud.myTeam === t ? ' · TÚ' : ''}
            </small>
            <b>{teamScore[t]}</b>
            <span className="bar">
              <i style={{ width: `${(teamScore[t] / scoreLimit) * 100}%` }} />
            </span>
            {hud.flags && <span className="flag-st">{flagStatus(hud.flags[t], players, you)}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (mode === 'gungame') {
    // Gun game: who is highest on the ladder
    const ladder = gunLadder(scoreLimit);
    const sorted = [...players].sort((a, b) => b.lv - a.lv || b.k - a.k);
    const top = sorted[0];
    if (!top) return null;
    const pos = sorted.findIndex((p) => p.id === you) + 1;
    const me = sorted[pos - 1];
    const gun = (p: PlayerSnapshot) =>
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

interface HudProps {
  hud: HudState | null;
  info: RoomView;
  engine: RefObject<MinimapSource | null>;
  map: GameMap;
  mode: ModeId;
  scoreLimit: number;
  you: string;
  feed: FeedItem[];
  banner: KillBanner | null;
}

export default function HUD({ hud, info, engine, map, mode, scoreLimit, you, feed, banner }: HudProps) {
  const settings = useSettings();
  if (!hud) return null;
  const alive = hud.alive;
  const scoped = alive && hud.scoped;
  const low = alive && hud.hp / hud.maxHp <= LOW_HP;
  const now = performance.now();
  const enemyFlag = hud.myTeam ? hud.flags?.[hud.myTeam === 1 ? 2 : 1] : undefined;
  const ownFlag = hud.myTeam ? hud.flags?.[hud.myTeam] : undefined;

  return (
    <div className="hud stage">
      {!scoped && <RoomInfo info={info} ping={hud.ping} />}
      {alive && !scoped && <Minimap engine={engine} map={map} radar={hud.radar} />}
      {alive && !scoped && <TopCenter hud={hud} mode={mode} scoreLimit={scoreLimit} you={you} />}
      {!scoped && <Feed feed={feed} you={you} mode={mode} />}

      {alive && (
        <>
          <div
            className={`vignette ${low ? 'low' : ''}`}
            style={low ? undefined : { opacity: Math.min(1, hud.damage * VIGNETTE_DAMAGE) }}
          />
          {scoped ? (
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
          ) : (
            <>
              {/* While aiming the gun's own sight is used (red dot or iron sight): the crosshair fades */}
              <div style={{ opacity: Math.max(0, 1 - hud.aim * AIM_FADE), transition: 'opacity 80ms' }}>
                <Crosshair key={hud.shotKey} cfg={settings.crosshair} spread={hud.spread} className="crosshair kick" />
              </div>
              <div className="center">
                {now - hud.hitKey < HITMARK_MS && (
                  <div key={hud.hitKey} className={`hitmark ${hud.hitRed ? 'red' : ''}`}>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
                {hud.dmgDirs.map((d) => (
                  <div key={d.key} className="dmg-dir" style={{ transform: `rotate(${d.angle}rad)`, opacity: d.life }}>
                    <i />
                  </div>
                ))}
                {hud.ticks.map((t) => (
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
                {hud.combo >= COMBO_MIN && (
                  <span key={hud.comboKey} className="combo">
                    ×{hud.combo}
                  </span>
                )}
              </div>
              {banner && (
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
              )}
            </>
          )}
          {enemyFlag?.c === you && !scoped && (
            <div className="ctf-carry">
              🚩 Llevas la bandera
              <small>
                {ownFlag?.h ? 'Llévala a tu base' : 'Tu bandera no está en tu base: recupérala para capturar'}
              </small>
            </div>
          )}
          {hud.protect > 0 && !scoped && (
            <div className="spawn-prot">
              🛡 Protegido {Math.ceil(hud.protect / MS_PER_S)} s<small>Disparar quita la protección</small>
            </div>
          )}
          <Health hud={hud} />
          <Ammo hud={hud} />
        </>
      )}
    </div>
  );
}
