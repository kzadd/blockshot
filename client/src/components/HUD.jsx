import { useEffect, useRef, useState } from 'react';
import { TEAMS, WEAPONS, isTeamMode, gunLadder } from '../../../shared/config.js';
import { hpColor } from '../game/models.js';
import { useSettings } from '../settings.js';
import Crosshair from './Crosshair.jsx';
import Minimap from './Minimap.jsx';

const TEAM_TXT = { 1: 'var(--eq-rojo-txt)', 2: 'var(--eq-azul-txt)' };

// Icono de tiro a la cabeza del killfeed: cuadro sol con dos ojos
const HeadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-label="cabeza">
    <rect x="1" y="1" width="14" height="14" rx="3" fill="#ffc93c" stroke="#1b2a4a" strokeWidth="2" />
    <rect x="4.5" y="6" width="2.5" height="3" fill="#1b2a4a" />
    <rect x="9" y="6" width="2.5" height="3" fill="#1b2a4a" />
  </svg>
);

export function Feed({ feed, you, mode }) {
  const color = (t) => (isTeamMode(mode) ? TEAM_TXT[t] : undefined);
  const now = Date.now();
  return (
    <div className="feed">
      {feed.map((f) => {
        const out = now - f.t > 5700 ? ' out' : '';
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
              🔥 <b style={{ color: color(f.team) }}>{f.name}</b> <span className="lbl">{f.label} ({f.n})</span>
            </div>
          );
        }
        return <div key={f.key} className={`feed-item notice${out}`}>{f.text}</div>;
      })}
    </div>
  );
}

export function RoomInfo({ info, ping }) {
  return (
    <div className="room-info">
      <b>{info.name}</b>
      <span>{info.map} · {info.size}</span>
      <span>{info.players}/{info.max} jugando</span>
      {ping > 0 && <span className={ping > 120 ? 'bad' : ''}>{ping} ms</span>}
    </div>
  );
}

// Vida a trozos: cada cuarto de barra que se pierde suelta 4 bloquecitos
function useChunks(hp, maxHp) {
  const prev = useRef(hp);
  const [chunks, setChunks] = useState([]);
  useEffect(() => {
    const before = Math.ceil((prev.current / maxHp) * 4);
    const after = Math.ceil((hp / maxHp) * 4);
    prev.current = hp;
    if (after >= before) return undefined;
    const born = Date.now();
    const add = [];
    for (let q = after + 1; q <= before; q++) {
      for (let i = 0; i < 4; i++) {
        add.push({ key: `${born}-${q}-${i}`, left: ((q - 0.5) / 4) * 100, i, dx: (i - 1.5) * 9 + (Math.random() - 0.5) * 6, rot: (Math.random() - 0.5) * 360 });
      }
    }
    setChunks((c) => [...c, ...add]);
    const t = setTimeout(() => setChunks((c) => c.filter((x) => !add.includes(x))), 1000);
    return () => clearTimeout(t);
  }, [hp, maxHp]);
  return chunks;
}

function Health({ hud }) {
  const pct = Math.max(0, hud.hp / hud.maxHp);
  const low = pct <= 0.25;
  const chunks = useChunks(hud.hp, hud.maxHp);
  return (
    <div className={`hp ${low ? 'low' : ''}`}>
      <b className="hp-num">{hud.hp}</b>
      <div className="hp-side">
        <div className="hp-labels hud-txt"><span>{hud.charName}</span><span>{hud.maxHp} máx.</span></div>
        <div style={{ position: 'relative' }}>
          <div className="hpbar">
            <span className="trail" style={{ width: `${pct * 100}%` }} />
            <span className="fill" style={{ width: `${pct * 100}%`, background: hpColor(pct) }} />
            <span className="marks" />
          </div>
          {chunks.map((c) => (
            <i key={c.key} className="chunk" style={{ left: `calc(${c.left}% - 3px)`, top: 6, animationDelay: `${c.i * 30}ms`, '--dx': `${c.dx}px`, '--rot': `${c.rot}deg` }} />
          ))}
        </div>
        {/* Estamina del sprint (Shift): se apaga cuando está llena; naranja si se agotó */}
        <div className={`stamina ${hud.stamina < 0.99 || hud.sprinting ? 'on' : ''} ${hud.staminaLow ? 'empty' : ''}`} title="Estamina">
          <i style={{ width: `${(hud.stamina ?? 1) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Ammo({ hud }) {
  const low = hud.mag > 0 && hud.mag <= hud.magSize * 0.25;
  return (
    <div className="ammo">
      <span className="hud-txt" style={{ fontSize: 14 }}>{hud.gunLevel ? `Arma ${hud.gunLevel}/${hud.gunTotal} · ` : ''}{hud.weaponName}</span>
      {hud.reloading ? (
        <div className="reloading">
          <b>Recargando</b>
          <div className="pbar"><i style={{ width: `${hud.reloadPct * 100}%`, transition: 'none' }} /></div>
        </div>
      ) : hud.melee ? (
        <div className="count"><b>🔪</b></div>
      ) : (
        <div className={`count ${hud.mag === 0 ? 'empty' : low ? 'low' : ''}`}><b>{hud.mag}</b><small>/{hud.magSize}</small></div>
      )}
      {!hud.scoped && (
        <div className="slots">
          {hud.loadout.map((n, i) => (
            <span key={n + i} className={hud.slot === i ? 'on' : ''}><em>{i + 1}</em>{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Captura la bandera: dónde está la bandera de cada equipo
function flagStatus(f, players, you) {
  if (!f) return '';
  if (f.h) return '🚩 En su base';
  if (!f.c) return '🚩 En el suelo';
  if (f.c === you) return '🚩 ¡La llevas tú!';
  return `🚩 La lleva ${players?.find((p) => p.id === f.c)?.n ?? '…'}`;
}

function TopCenter({ hud, mode, scoreLimit, you }) {
  if (isTeamMode(mode) && hud.teamScore) {
    return (
      <div className="team-score">
        {[1, 2].map((t) => (
          <div key={t} className={`ts ${hud.myTeam === t ? 'mine' : ''}`} style={{ '--t': `var(--eq-${t === 1 ? 'rojo' : 'azul'})`, '--tt': TEAM_TXT[t] }}>
            <small>{TEAMS[t].name.toUpperCase()}{hud.myTeam === t ? ' · TÚ' : ''}</small>
            <b>{hud.teamScore[t]}</b>
            <span className="bar"><i style={{ width: `${(hud.teamScore[t] / scoreLimit) * 100}%` }} /></span>
            {hud.flags && <span className="flag-st">{flagStatus(hud.flags[t], hud.players, you)}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (mode === 'gungame') {
    // Escalada de armas: quién va más arriba en la escalera
    const ladder = gunLadder(scoreLimit);
    const sorted = [...(hud.players || [])].sort((a, b) => b.lv - a.lv || b.k - a.k);
    if (!sorted.length) return null;
    const pos = sorted.findIndex((p) => p.id === you) + 1;
    const top = sorted[0];
    const me = sorted[pos - 1];
    const gun = (p) => `${WEAPONS[ladder[Math.min(p.lv, ladder.length - 1)]].name} (${p.lv + 1}/${ladder.length})`;
    return (
      <div className="leader">
        <span className="first">1º {pos === 1 ? 'Tú' : top.n} · {gun(top)}</span>
        <span className="sep" />
        <span>{pos === 1 ? `Tú · ${gun(me)}` : `Tú ${pos}º · ${me ? gun(me) : ''}`}</span>
      </div>
    );
  }
  // Pastilla de líder (todos contra todos)
  const sorted = [...(hud.players || [])].sort((a, b) => b.k - a.k || a.d - b.d);
  if (!sorted.length) return null;
  const pos = sorted.findIndex((p) => p.id === you) + 1;
  const me = sorted[pos - 1];
  // Si vas primero, a la derecha se ve quién te sigue
  const right = pos === 1 ? (sorted[1] ? `2º ${sorted[1].n} · ${sorted[1].k}` : `Tú · ${me.k}/${scoreLimit}`) : `Tú ${pos}º · ${me?.k ?? 0}/${scoreLimit}`;
  return (
    <div className="leader">
      <span className="first">1º {pos === 1 ? 'Tú' : sorted[0].n} · {sorted[0].k}{pos === 1 ? `/${scoreLimit}` : ''}</span>
      <span className="sep" />
      <span>{right}</span>
    </div>
  );
}

export default function HUD({ hud, info, engine, map, mode, scoreLimit, you, feed, banner }) {
  const settings = useSettings();
  if (!hud) return null;
  const alive = hud.alive;
  const scoped = alive && hud.scoped;
  const low = alive && hud.hp / hud.maxHp <= 0.25;
  const now = performance.now();

  return (
    <div className="hud stage">
      {!scoped && <RoomInfo info={info} ping={hud.ping} />}
      {alive && !scoped && <Minimap engine={engine} map={map} />}
      {alive && !scoped && <TopCenter hud={hud} mode={mode} scoreLimit={scoreLimit} you={you} />}
      {!scoped && <Feed feed={feed} you={you} mode={mode} />}

      {alive && (
        <>
          <div className={`vignette ${low ? 'low' : ''}`} style={low ? undefined : { opacity: Math.min(1, hud.damage * 0.8) }} />
          {scoped ? (
            <div className="scope">
              <div className="ring" />
              <i className="h" /><i className="v" />
              <i className="h thick" /><i className="h thick r" /><i className="v thick" />
              <i className="dot" />
              <span className="scope-hint">Clic der. para salir · el resto del HUD se oculta mientras apuntas</span>
            </div>
          ) : (
            <>
              {/* Al apuntar se usa la mira del arma (punto rojo o alza): la cruz se desvanece */}
              <div style={{ opacity: Math.max(0, 1 - hud.aim * 2.5), transition: 'opacity 80ms' }}>
                <Crosshair key={hud.shotKey} cfg={settings.crosshair} spread={hud.spread} className="crosshair kick" />
              </div>
              <div className="center">
                {now - hud.hitKey < 300 && (
                  <div key={hud.hitKey} className={`hitmark ${hud.hitRed ? 'red' : ''}`}><i /><i /><i /><i /></div>
                )}
                {hud.dmgDirs.map((d) => (
                  <div key={d.key} className="dmg-dir" style={{ transform: `rotate(${d.angle}rad)`, opacity: d.life }}><i /></div>
                ))}
                {hud.ticks.map((t) => (
                  <div key={t.key} className="tick" style={{ transform: `rotate(${t.angle}rad)` }}>
                    {[-14, 0, 14].map((dx) => (
                      <i key={dx} style={{ left: dx - 4, top: -168 + Math.abs(dx) * 0.2, height: dx === 0 ? 14 : 9, background: t.color }} />
                    ))}
                  </div>
                ))}
                {hud.combo >= 2 && <span key={hud.comboKey} className="combo">×{hud.combo}</span>}
              </div>
              {banner && (
                <div className="kill-banner" key={banner.key}>
                  <span className="line1">Eliminaste a <span className="v">{banner.name}</span>{banner.head && <span className="h"> · cabeza</span>}</span>
                  {banner.label && <span className="line2">🔥 {banner.label} · {banner.n} seguidas</span>}
                </div>
              )}
            </>
          )}
          {hud.flags && hud.myTeam && hud.flags[3 - hud.myTeam]?.c === you && !scoped && (
            <div className="ctf-carry">🚩 Llevas la bandera<small>{hud.flags[hud.myTeam]?.h ? 'Llévala a tu base' : 'Tu bandera no está en tu base: recupérala para capturar'}</small></div>
          )}
          {hud.protect > 0 && !scoped && (
            <div className="spawn-prot">🛡 Protegido {Math.ceil(hud.protect / 1000)} s<small>Disparar quita la protección</small></div>
          )}
          <Health hud={hud} />
          <Ammo hud={hud} />
        </>
      )}
    </div>
  );
}
