import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { Engine } from '../game/Engine.js';
import { getMap, CHAR_BY_ID, PLAYER, STREAKS, canSwitchTeam, teamName } from '../../../shared/config.js';
import { sfx } from '../game/sound.js';
import { useSettings } from '../settings.js';
import { Keys, playCurtain } from '../ui.jsx';
import HUD, { Feed, RoomInfo } from './HUD.jsx';
import CharacterSelect from './CharacterSelect.jsx';
import Scoreboard from './Scoreboard.jsx';
import Settings from './Settings.jsx';
import Manual from './Manual.jsx';

let feedId = 0;

const PAUSE_KEYS = [
  [['W', 'A', 'S', 'D'], 'Moverse'], [['Espacio'], 'Saltar · mantén para encadenar'],
  [['Shift'], 'Esprintar'], [['C'], 'Agacharse · deslizarse'],
  [['Clic izq.'], 'Disparar'], [['Clic der.'], 'Apuntar'],
  [['R'], 'Recargar'], [['1', '2', '3', 'Q'], 'Cambiar de arma (3: cuchillo)'],
  [['Tab'], 'Marcador'], [['Esc'], 'Pausa'],
];
const WIN_COLOR = { 1: 'var(--eq-rojo-txt)', 2: 'var(--eq-azul-txt)' };

const loadChar = () => {
  try {
    const id = localStorage.getItem('blockshot:char');
    return CHAR_BY_ID[id] ? id : null;
  } catch {
    return null;
  }
};
const loadSkins = () => {
  try {
    return JSON.parse(localStorage.getItem('blockshot:skins')) || {};
  } catch {
    return {};
  }
};

export default function Game({ session, onLeave }) {
  const mount = useRef(null);
  const engine = useRef(null);
  const settings = useSettings();
  const [hud, setHud] = useState(null);
  const [feed, setFeed] = useState([]);
  const [showScores, setShowScores] = useState(false);
  const [match, setMatch] = useState(null);
  const [charId, setCharId] = useState(loadChar);
  const [skins, setSkins] = useState(loadSkins); // skin elegida para cada personaje
  const [selecting, setSelecting] = useState(true); // al entrar se elige personaje
  const [menu, setMenu] = useState(null); // 'settings' | 'manual'
  const [banner, setBanner] = useState(null); // aviso central al eliminar a alguien
  const [lastDeath, setLastDeath] = useState(null); // quién te eliminó
  const [shake, setShake] = useState('');
  const { room, you } = session;
  const map = getMap(room.mapId, room.size);
  const live = useRef({});
  live.current = { hud, match, menu };

  const info = { name: room.name, map: map.name, size: map.sizeName, players: hud?.players?.length || 1, max: room.max || '?' };

  useEffect(() => {
    engine.current = new Engine(mount.current, socket, you, setHud, getMap(room.mapId, room.size), room.mode, room.scoreLimit);
    return () => engine.current.destroy();
  }, [you, room.mapId, room.size, room.mode]);

  // Red de seguridad: si algo intenta cerrar la pestaña en plena partida (Ctrl+W, F5…), el navegador pregunta antes
  useEffect(() => {
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  // Mientras se elige personaje no se reaparece solo
  useEffect(() => {
    if (engine.current) engine.current.autoChar = selecting || !charId ? null : { id: charId, skin: skins[charId] || 'base' };
  }, [selecting, charId, skins]);

  // Cortinilla de bloques al aparecer / reaparecer
  const wasAlive = useRef(false);
  useEffect(() => {
    if (hud?.alive && !wasAlive.current) playCurtain();
    wasAlive.current = !!hud?.alive;
  }, [hud?.alive]);

  // Sacudida suave al recibir daño (desactivable en Ajustes)
  const lastDamage = useRef(0);
  useEffect(() => {
    const k = hud?.damageKey;
    if (!k || k === lastDamage.current) return undefined;
    lastDamage.current = k;
    if (!settings.shake || !hud.alive) return undefined;
    setShake((s) => (s === 'shake-a' ? 'shake-b' : 'shake-a'));
    const t = setTimeout(() => setShake(''), 170);
    return () => clearTimeout(t);
  }, [hud?.damageKey, hud?.alive, settings.shake]);

  useEffect(() => {
    const push = (item) => setFeed((f) => [...f.slice(-4), { ...item, key: ++feedId, t: Date.now() }]);
    let bannerTimer = 0;
    const onKill = (d) => {
      push({ type: 'kill', ...d });
      const label = STREAKS[d.streak];
      if (label) push({ type: 'streak', name: d.killerName, team: d.killerTeam, label, n: d.streak });
      if (d.ended) push({ type: 'notice', text: `${d.killerName} acabó con la racha de ${d.victimName} (${d.ended})` });
      if (d.victim === you) setLastDeath({ name: d.killerName, char: d.killerChar, weapon: d.weapon, hp: d.killerHp });
      if (d.killer === you) {
        if (label || d.reward) sfx.streak();
        clearTimeout(bannerTimer);
        setBanner({ key: Date.now(), name: d.victimName, head: d.head, label, n: d.streak, reward: d.reward });
        bannerTimer = setTimeout(() => setBanner(null), 2300);
      }
    };
    const onNotice = (text) => push({ type: 'notice', text });
    const onEnd = (d) => setMatch({ ...d, at: Date.now() });
    const onStart = () => {
      setMatch(null);
      setLastDeath(null);
    };
    const onDisc = () => onLeave();
    socket.on('kill', onKill);
    socket.on('notice', onNotice);
    socket.on('match:end', onEnd);
    socket.on('match:start', onStart);
    socket.on('disconnect', onDisc);
    // Cada línea del killfeed dura 6 s (los últimos 300 ms se desvanece)
    const prune = setInterval(() => setFeed((f) => f.filter((x) => Date.now() - x.t < 6000)), 300);

    const down = (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScores(true);
      }
      const { hud: h, match: m, menu: open } = live.current;
      // Esc en la pantalla de pausa: volver a jugar (igual que el clic)
      if (e.code === 'Escape' && !e.repeat && h?.alive && !h.locked && !m && !open) {
        engine.current.requestLock();
        return;
      }
      // O: ajustes · H o F1: manual
      const want = e.code === 'KeyO' ? 'settings' : e.code === 'KeyH' || e.code === 'F1' ? 'manual' : null;
      if (want && !e.repeat) {
        e.preventDefault();
        setMenu((cur) => (cur === want ? null : want));
        document.exitPointerLock?.();
        return;
      }
      // T: cambiar de equipo (por equipos)
      if (e.code === 'KeyT' && !e.repeat && canSwitchTeam(room.mode) && h?.myTeam && !m && !open) {
        socket.emit('team:set', { team: 3 - h.myTeam });
      }
      // B: cambiar de personaje, solo estando muerto (se aplica al reaparecer)
      if (e.code === 'KeyB' && h?.everSpawned && !h.alive && !m && !open) {
        setSelecting(true);
        document.exitPointerLock?.();
      }
    };
    const up = (e) => e.code === 'Tab' && setShowScores(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      socket.off('kill', onKill);
      socket.off('notice', onNotice);
      socket.off('match:end', onEnd);
      socket.off('match:start', onStart);
      socket.off('disconnect', onDisc);
      clearInterval(prune);
      clearTimeout(bannerTimer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onLeave, you]);

  const pick = (characterId, skin) => {
    const next = { ...skins, [characterId]: skin };
    try {
      localStorage.setItem('blockshot:char', characterId);
      localStorage.setItem('blockshot:skins', JSON.stringify(next));
    } catch {}
    setCharId(characterId);
    setSkins(next);
    setSelecting(false);
    engine.current.requestLock(); // debe ir dentro del clic
    engine.current.spawn(characterId, skin); // aparece ya, o al acabar la cuenta atrás
  };
  const keep = () => {
    setSelecting(false);
    engine.current.requestLock();
  };
  const leave = () => {
    socket.emit('room:leave');
    onLeave();
  };

  const alive = hud?.alive;
  const dead = hud && !alive && hud.everSpawned && !selecting && !match;
  const choosing = hud && !alive && selecting && !match;
  const paused = hud && alive && !hud.locked && !match && !menu;
  const me = CHAR_BY_ID[charId];
  const killer = lastDeath && CHAR_BY_ID[lastDeath.char];
  const sec = hud ? Math.ceil(hud.respawnIn / 1000) : 0;

  return (
    <div className={`game ${shake}`}>
      <div className="canvas" ref={mount} />

      {!choosing && !dead && (
        <HUD
          hud={hud}
          info={info}
          engine={engine}
          map={map}
          mode={room.mode}
          scoreLimit={room.scoreLimit}
          you={you}
          feed={feed}
          banner={banner}
        />
      )}

      {dead && (
        <div className="layer stage">
          <div className="death-bg" />
          <div className="death">
            <h2>{lastDeath ? <>Te eliminó <span className="k">{lastDeath.name}</span></> : '¡Nueva partida!'}</h2>
            {lastDeath && killer && (
              <div className="killer-chip">
                <span className="chip-char" style={{ '--c': killer.color }}>{killer.name}</span>
                <span>{lastDeath.weapon} · le quedaban <b>{lastDeath.hp}</b> de vida</span>
              </div>
            )}
            <div className="countdown"><b key={sec}>{Math.max(1, sec)}</b></div>
            <div className="pbar fill"><i key={hud.deathKey} style={{ animationDuration: `${PLAYER.respawnDelay}ms` }} /></div>
            {me && <div className="as">Reapareces como <span className="chip-char" style={{ '--c': me.color }}>{me.name}</span></div>}
            <button className="btn has-key" onClick={() => setSelecting(true)}><span className="key">B</span>Cambiar personaje</button>
          </div>
          <Feed feed={feed} you={you} mode={room.mode} />
          <RoomInfo info={info} ping={hud.ping} />
        </div>
      )}

      {choosing && (
        <CharacterSelect
          info={info}
          current={charId}
          skins={skins}
          fromDeath={hud.everSpawned}
          respawnIn={hud.everSpawned ? hud.respawnIn : 0}
          onPick={pick}
          onKeep={hud.everSpawned && charId ? keep : null}
          onLeave={leave}
          mode={room.mode}
          myTeam={hud.myTeam}
          players={hud.players}
          onTeam={(team) => socket.emit('team:set', { team })}
        />
      )}

      {paused && (
        <div className="pause-bg" onClick={() => engine.current.requestLock()}>
          <div className="stage">
            <div className="pause-panel">
              <h2>Pausa</h2>
              <p className="sub"><b>Haz clic o pulsa Esc para volver</b> · los demás siguen jugando</p>
              <div className="key-grid">
                {PAUSE_KEYS.map(([keys, what]) => (
                  <div className="key-row" key={what}><Keys keys={keys} /><span>{what}</span></div>
                ))}
              </div>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn has-key" onClick={() => setMenu('settings')}><span className="key">O</span>Ajustes</button>
                <button className="btn has-key" onClick={() => setMenu('manual')}><span className="key">H</span>Manual</button>
                {canSwitchTeam(room.mode) && hud.myTeam && (
                  <button className="btn has-key" onClick={() => socket.emit('team:set', { team: 3 - hud.myTeam })}>
                    <span className="key">T</span>Pasar a {teamName(room.mode, 3 - hud.myTeam)}
                  </button>
                )}
                <button className="btn ghost danger" onClick={leave}>Salir de la sala</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(showScores || match) && hud && (
        <div className={`scores-layer ${match ? 'end' : ''}`}>
          <div className="stage">
            {match && (
              <div className="end-head">
                <h2 style={{ color: WIN_COLOR[match.team] || 'var(--sol)' }}>¡{match.winner} gana la partida!</h2>
                <div className="sub">
                  Nueva partida en unos segundos…
                  <div className="pbar fill"><i key={match.at} style={{ animationDuration: `${match.restartIn}ms` }} /></div>
                </div>
                {match.best?.length > 0 && (
                  <div className="best">
                    {match.best.map((b, i) => (
                      <div key={b.t} className="best-card" style={{ animationDelay: `${i * 120}ms` }}>
                        <span className="kicker">Mejor jugada</span>
                        <span className="t">{b.t}</span>
                        <span className="v">{b.v}</span>
                        <span className="n">{b.n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Scoreboard players={hud.players} me={you} info={info} scoreLimit={room.scoreLimit} mode={room.mode} teamScore={hud.teamScore} />
          </div>
        </div>
      )}

      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'manual' && <Manual onClose={() => setMenu(null)} />}
    </div>
  );
}
