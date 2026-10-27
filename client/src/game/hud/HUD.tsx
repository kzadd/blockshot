import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ABILITIES,
  CHAR_BY_ID,
  SHIELD,
  MEDALS,
  QUICK_CHAT,
  ZONE_NAMES,
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
  type WeaponId,
} from '@blockshot/shared';
import Crosshair from '../../settings/Crosshair';
import { useSettings } from '../../settings/settingsStore';
import { ABILITY_ICON, Icon } from '../../ui/icons';
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
  | { type: 'chat'; name: string; team: Team; text: string }
);

export interface KillBanner {
  key: number;
  name: string;
  head: boolean;
  label: string | undefined;
  n: number;
  reward: string | undefined;
  medals: string[];
}

const ARMOR_MAX = Object.values(STREAK_REWARDS).find((r) => r.id === 'armor')?.amount ?? 50;
const LOW_HP = 0.25;
const HALF_HP = 0.5;
const LOW_AMMO = 0.25;
const HEALTH_CHUNKS = 4;
const CHUNK_PIECES = 4;
const CHUNK_LIFE_MS = 1000;
const COMBO_MIN = 2;
const BAD_PING_MS = 120;
/** Killfeed lines on screen at most. */
const FEED_MAX = 5;
/** Crosshair fades out while the gun's own sight comes up. */
const AIM_FADE = 2.5;
const VIGNETTE_DAMAGE = 0.8;
const MS_PER_S = 1000;

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / MS_PER_S));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Headshot mark in the killfeed: a small Señal block
const HeadIcon = () => <i className="head-mark" role="img" aria-label="a la cabeza" />;

export function Feed({ feed, you, mode }: { feed: FeedItem[]; you: string; mode: ModeId }) {
  const color = (t: Team) => (isTeamMode(mode) && t ? TEAM_TXT[t] : undefined);
  return (
    <div className="feed">
      {feed.slice(-FEED_MAX).map((f) => {
        const out = f.out ? ' out' : '';
        if (f.type === 'kill') {
          const cls = f.killer === you ? ' mine' : f.victim === you ? ' died' : '';
          return (
            <div key={f.key} className={`feed-item${cls}${out}`}>
              <b style={{ color: color(f.killerTeam) }}>{f.killerName}</b>
              <span className="w">{f.weapon}</span>
              {f.head && <HeadIcon />}
              <b style={{ color: color(f.victimTeam) }}>{f.victimName}</b>
              {f.medals.map((m) => (
                <span key={m} className="medal">
                  {MEDALS[m]}
                </span>
              ))}
            </div>
          );
        }
        if (f.type === 'streak') {
          return (
            <div key={f.key} className={`feed-item streak${out}`}>
              <Icon name="flame" size={14} />
              <b style={{ color: color(f.team) }}>{f.name}</b>
              <span className="lbl">
                {f.label} ({f.n})
              </span>
            </div>
          );
        }
        if (f.type === 'chat') {
          return (
            <div key={f.key} className={`feed-item chat${out}`}>
              <Icon name="message" size={14} />
              <b style={{ color: color(f.team) }}>{f.name}</b>
              <span>{f.text}</span>
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

/** In game the room details live in the scoreboard (Tab): only a bad connection is shown. */
function NetWarning() {
  const ping = useHud((h) => h.ping) ?? 0;
  if (ping <= BAD_PING_MS) return null;
  return (
    <div className="hud-chip net-warn">
      <Icon name="wifi" size={13} />
      Conexión lenta · {ping} ms
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
    characterId: s.characterId,
    armor: s.armor,
    stamina: s.stamina,
    staminaLow: s.staminaLow,
    sprinting: s.sprinting,
    mode: s.mode,
    myTeam: s.myTeam,
  }));
  const chunks = useChunks(h?.hp ?? 0, h?.maxHp ?? 1);
  if (!h) return null;
  const pct = Math.max(0, h.hp / h.maxHp);
  const low = pct <= LOW_HP;
  const tone = low ? 'low' : pct <= HALF_HP ? 'mid' : '';
  const char = h.characterId ? CHAR_BY_ID[h.characterId] : undefined;
  return (
    <div className={`hud-block hp ${tone}`}>
      {/* Which side you are on, always in sight in team modes */}
      {isTeamMode(h.mode) && h.myTeam !== 0 && (
        <span className="team-badge" style={{ '--t': teamVar(h.myTeam), '--tt': TEAM_TXT[h.myTeam] }}>
          Equipo {teamName(h.mode, h.myTeam)}
        </span>
      )}
      <b className="hp-num">{h.hp}</b>
      <div className="hp-side">
        <div className="hp-labels">
          <span className="hp-class" style={{ '--c': char?.color }}>
            {char?.name}
          </span>
          {h.armor > 0 ? (
            <span className="armor-num">Blindaje {h.armor}</span>
          ) : (
            <span className="hp-max">/ {h.maxHp}</span>
          )}
        </div>
        <div className="relative">
          {/* Four quarter blocks, like the world's pieces */}
          <div className="hpbar">
            {Array.from({ length: HEALTH_CHUNKS }, (_, i) => (
              <span key={i}>
                <i style={{ width: `${Math.max(0, Math.min(1, pct * HEALTH_CHUNKS - i)) * 100}%` }} />
              </span>
            ))}
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

/** Key E: the character's ability, lit when ready, counting down otherwise. */
function AbilityChip() {
  const a = useHud((s) => s.ability);
  if (!a) return null;
  const { name, cooldownMs } = ABILITIES[a.id];
  const ready = a.left <= 0;
  return (
    <span className={`abil ${ready ? 'ready' : ''}`} title={`${name} (E)`}>
      <em>E</em>
      <Icon name={ABILITY_ICON[a.id]} size={14} />
      {ready ? name : <small>{Math.ceil(a.left / 1000)} s</small>}
      {!ready && <i style={{ width: `${(1 - a.left / cooldownMs) * 100}%` }} />}
    </span>
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
    grenades: s.grenades,
  }));
  if (!h) return null;
  const low = h.mag > 0 && h.mag <= h.magSize * LOW_AMMO;
  // Scoped: the rest of the HUD hides, so the block names the weapon; gun game shows the ladder step
  const label = h.scoped ? h.weaponName : h.gunLevel ? `Arma ${h.gunLevel}/${h.gunTotal}` : '';
  return (
    <div className="hud-block ammo">
      <div className="ammo-main">
        {label && <span className="wname">{label}</span>}
        {h.reloading ? (
          <div className="reloading">
            <b>Recargando</b>
            <div className="pbar">
              <i style={{ width: `${h.reloadPct * 100}%`, transition: 'none' }} />
            </div>
          </div>
        ) : h.melee ? (
          <span className="melee">Por la espalda: {WEAPONS.knife.backstab}</span>
        ) : (
          <div className={`count ${h.mag === 0 ? 'empty' : low ? 'low' : ''}`}>
            <b>{h.mag}</b>
            <small> /{h.magSize}</small>
          </div>
        )}
      </div>
      {!h.scoped && (
        <div className="slots">
          {h.loadout.map((n, i) => (
            <span key={n + i} className={h.slot === i ? 'on' : ''}>
              <em>{i + 1}</em>
              {h.slot === i && n}
            </span>
          ))}
          <span className={`gren ${h.grenades ? '' : 'used'}`} title="Granada">
            <em>G</em>
            <Icon name="bomb" size={14} />
          </span>
          <AbilityChip />
        </div>
      )}
    </div>
  );
}

// Capture the flag: where each team's flag is
function flagStatus(f: FlagSnapshot | undefined, players: HudPlayer[], you: string): string {
  if (!f) return '';
  if (f.h) return 'Bandera en su base';
  if (!f.c) return 'Bandera en el suelo';
  if (f.c === you) return '¡La llevas tú!';
  return `La lleva ${players.find((p) => p.id === f.c)?.n ?? '…'}`;
}

function TopCenter({ mode, scoreLimit, you }: { mode: ModeId; scoreLimit: number; you: string }) {
  const h = useHud((s) => ({
    players: s.players,
    myTeam: s.myTeam,
    infect: s.infect,
    teamScore: s.teamScore,
    flags: s.flags,
    zones: s.zones,
    round: s.round,
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
      <div className="hud-top infect-bar">
        <span className="sv">
          {count(1)} {count(1) === 1 ? 'superviviente' : 'supervivientes'}
          {h.myTeam === 1 ? ' · TÚ' : ''}
        </span>
        <span className="pill clock">{status}</span>
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
      <>
        <div className="team-score">
          {SIDES.map((t) => (
            <div
              key={t}
              className={`ts ${h.myTeam === t ? 'mine' : ''}`}
              style={{ '--t': teamVar(t), '--tt': TEAM_TXT[t], order: t === 1 ? 0 : 2 }}
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
          <span className="ts-limit">/ {scoreLimit}</span>
        </div>
        {h.zones && (
          <div className="top-sub zones">
            {h.zones.map(([owner, v, contested], i) => (
              <span
                key={ZONE_NAMES[i]}
                className={`zone ${owner ? 'owned' : ''} ${contested ? 'contested' : ''}`}
                style={{
                  '--t': owner ? teamVar(owner) : undefined,
                  '--p': `${Math.abs(v)}%`,
                  '--pc': v ? teamVar(v > 0 ? 1 : 2) : undefined,
                }}
              >
                {ZONE_NAMES[i]}
              </span>
            ))}
          </div>
        )}
        {h.round && <span className="top-sub round-st">{roundStatus(h.round)}</span>}
      </>
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
      <div className="hud-top leader">
        <span className="first">1º {pos === 1 ? 'Tú' : top.n}</span>
        <span className="pill">{gun(top)}</span>
        {pos !== 1 && me && (
          <>
            <span className="me">Tú {pos}º</span>
            <span className="pill">{gun(me)}</span>
          </>
        )}
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
  // When you lead, the right side shows who follows you (nothing when you are alone)
  const right =
    pos === 1 ? (second ? { who: `2º ${second.n}`, k: second.k } : null) : { who: `Tú ${pos}º`, k: me?.k ?? 0 };
  return (
    <div className="hud-top leader">
      <span className="first">1º {pos === 1 ? 'Tú' : first.n}</span>
      <span className="pill">
        {first.k} / {scoreLimit}
      </span>
      {right && (
        <>
          <span className="me">{right.who}</span>
          <span className="pill">{right.k}</span>
        </>
      )}
    </div>
  );
}

/** Rounds: what the round is doing, for the team score widget. */
function roundStatus(r: { p: number; n: number; t: number }): string {
  if (r.p === 0) return 'Esperando a un rival';
  if (r.p === 2) return `Ronda ${r.n + 1} en ${Math.ceil(r.t / MS_PER_S)} s`;
  return `Ronda ${r.n} · ${clock(r.t)}`;
}

/** How strongly the screen blood shows right after a hit (× the damage flash). */
const BLOOD_SCREEN = 0.9;

function Vignette() {
  const h = useHud((s) => ({ low: s.hp / s.maxHp <= LOW_HP, damage: s.damage }));
  if (!h) return null;
  return (
    <>
      <div
        className={`vignette ${h.low ? 'low' : ''}`}
        style={h.low ? undefined : { opacity: Math.min(1, h.damage * VIGNETTE_DAMAGE) }}
      />
      {/* Blood on the screen edges right after a hit */}
      {h.damage > 0 && <div className="blood-screen" style={{ opacity: Math.min(1, h.damage * BLOOD_SCREEN) }} />}
    </>
  );
}

function GrenadeHint() {
  return useHud((s) => s.grenadeAim) ? (
    <div className="grenade-hint">
      Suelta <kbd>G</kbd> para lanzar
    </div>
  ) : null;
}

function ShieldRim() {
  const h = useHud((s) => ({ left: s.shield, hit: s.shieldHit }));
  if (!h?.left) return null;
  return (
    <>
      <div className={`shield-rim ${h.hit ? 'hit' : ''}`} />
      <div className="shield-hud">
        <span>
          <Icon name="shield" size={14} />
          Escudo · para las balas de delante
          <b>{(h.left / 1000).toFixed(1)} s</b>
        </span>
        <i style={{ width: `${(h.left / SHIELD.durationMs) * 100}%` }} />
      </div>
    </>
  );
}

/** Inside a smoke cloud: the screen goes grey (the cloud is opaque from inside too). */
function SmokeFog() {
  const k = useHud((s) => s.smoke);
  return k ? <div className="smoke-fog" style={{ opacity: k }} /> : null;
}

/** The sight each gun shows while fully aimed (the 3D gun steps aside so the target stays in view). */
const SIGHT: Partial<Record<WeaponId, 'dot' | 'post' | 'ring' | 'scope'>> = {
  rifle: 'dot',
  smg: 'dot',
  lmg: 'dot',
  mpistol: 'dot',
  pistol: 'post',
  revolver: 'post',
  shotgun: 'ring',
  sawedoff: 'ring',
  launcher: 'ring',
  dmr: 'scope',
};

function AdsSight({ id }: { id: WeaponId }) {
  const shotKey = useHud((s) => s.shotKey);
  const kind = SIGHT[id] ?? 'dot';
  return (
    <div className={`ads-sight ${kind}`}>
      <div key={shotKey} className="ads-reticle">
        <i className="dot" />
        {kind !== 'dot' && <i className="frame" />}
      </div>
    </div>
  );
}

/** Radial streaks at the screen edges: their strength follows the speed above sprinting (slides, hops). */
function SpeedLines() {
  const fx = useHud((s) => s.speedFx);
  if (!fx) return null;
  return <div className="speed-lines" style={{ opacity: fx }} />;
}

function Scope() {
  return (
    <div className="scope">
      <div className="lens" />
      <i className="l h left" />
      <i className="l h right" />
      <i className="l v top" />
      <i className="l v bottom" />
      <i className="p h left" />
      <i className="p h right" />
      <i className="p v bottom" />
      <i className="ticks" />
      <i className="dot" />
      <span className="scope-hint">
        <kbd>Clic der.</kbd>
        para salir · el resto del HUD se oculta mientras apuntas
      </span>
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
        <Icon name="crosshair" size={18} />
        Eliminaste a <span className="v">{banner.name}</span>
      </span>
      {banner.head && <span className="line2">A la cabeza</span>}
      {banner.label && (
        <span className="line2 streak">
          <Icon name="flame" size={14} />
          {banner.label} · {banner.n} seguidas
        </span>
      )}
      {banner.medals.length > 0 && (
        <span className="line2 medals">
          <Icon name="award" size={14} />
          {banner.medals.join(' · ')}
        </span>
      )}
      {banner.reward && (
        <span className="line2">
          <Icon name="gift" size={14} />
          {banner.reward}
        </span>
      )}
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
      <span>
        <Icon name="flag" size={18} />
        Llevas la bandera
      </span>
      <small>{h.ownHome ? 'Llévala a tu base' : 'Tu bandera no está en tu base: recupérala para capturar'}</small>
    </div>
  );
}

// Quick chat menu (V): numbered phrases, picked with the number keys
function QuickChat() {
  const open = useHud((s) => s.chatOpen);
  if (!open) return null;
  return (
    <div className="quick-chat">
      <span className="kicker">
        <Icon name="message" size={13} />
        Chat rápido
      </span>
      {QUICK_CHAT.map((c, i) => (
        <div key={c.text} className="qc-row">
          <kbd>{i + 1}</kbd>
          <span>{c.text}</span>
          {c.all && <small>todos</small>}
        </div>
      ))}
      <span className="qc-hint">
        <kbd>V</kbd> cerrar
      </span>
    </div>
  );
}

function SpawnProtection() {
  const seconds = useHud((s) => Math.ceil(s.protect / MS_PER_S)) ?? 0;
  if (seconds <= 0) return null;
  return (
    <div className="hud-chip spawn-prot">
      <Icon name="shield" size={13} />
      Protegido <b>{seconds} s</b>
      <small>· disparar la quita</small>
    </div>
  );
}

interface HudProps {
  engine: RefObject<MinimapSource | null>;
  map: GameMap;
  mode: ModeId;
  scoreLimit: number;
  you: string;
  feed: FeedItem[];
  banner: KillBanner | null;
}

export default function HUD({ engine, map, mode, scoreLimit, you, feed, banner }: HudProps) {
  const h = useHud((s) => ({ alive: s.alive, scoped: s.alive && s.scoped, radar: s.radar, sight: s.adsSight }));
  if (!h) return null;
  const { alive, scoped } = h;
  return (
    <div className="hud stage">
      {/* First, so the rest of the HUD stays readable inside the smoke */}
      {alive && <SmokeFog />}
      {alive && !scoped && <Minimap engine={engine} map={map} radar={h.radar} />}
      {alive && !scoped && <NetWarning />}
      {alive && !scoped && <TopCenter mode={mode} scoreLimit={scoreLimit} you={you} />}
      {!scoped && <Feed feed={feed} you={you} mode={mode} />}

      {alive && (
        <>
          <Vignette />
          <ShieldRim />
          {!scoped && <GrenadeHint />}
          {!scoped && <SpeedLines />}
          {scoped ? (
            <Scope />
          ) : (
            <>
              {h.sight ? <AdsSight id={h.sight} /> : <AimCrosshair />}
              <CenterMarks />
              <Banner banner={banner} />
            </>
          )}
          {!scoped && <CarryingFlag you={you} />}
          {!scoped && <SpawnProtection />}
          {!scoped && <QuickChat />}
          <Health />
          <Ammo />
        </>
      )}
    </div>
  );
}
