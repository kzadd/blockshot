import { useEffect, useRef, useState } from 'react';
import {
  CHAR_BY_ID,
  PLAYER,
  STREAKS,
  canSwitchTeam,
  getMap,
  isCharacterId,
  teamName,
  type CharacterId,
  type KillEvent,
  type MatchEnd,
  type SideTeam,
  type SkinId,
} from '@blockshot/shared';
import type { Session } from '../app/App';
import CharacterSelect, { type SkinChoice } from '../characters/CharacterSelect';
import Manual from '../manual/Manual';
import { socket } from '../network/socket';
import Settings from '../settings/SettingsDialog';
import { useSettings } from '../settings/settingsStore';
import { Keys, playCurtain } from '../ui/ui';
import { sfx } from './audio/sound';
import { Engine } from './engine/Engine';
import HUD, { Feed, RoomInfo, type FeedItem, type KillBanner } from './hud/HUD';
import type { HudState } from './hud/hudState';
import Scoreboard from './hud/Scoreboard';
import { TEAM_TXT } from './hud/teamStyle';
import type { RoomView } from './roomView';

let feedId = 0;

const CHAR_KEY = 'blockshot:char';
const SKINS_KEY = 'blockshot:skins';
/** Killfeed keeps the last few lines, each for FEED_LIFE_MS. */
const FEED_MAX = 5;
const FEED_LIFE_MS = 6000;
const FEED_PRUNE_MS = 300;
const BANNER_MS = 2300;
const SHAKE_MS = 170;

const PAUSE_KEYS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Moverse'],
  [['Espacio'], 'Saltar · mantén para encadenar'],
  [['Shift'], 'Esprintar'],
  [['C'], 'Agacharse · deslizarse'],
  [['Clic izq.'], 'Disparar'],
  [['Clic der.'], 'Apuntar'],
  [['R'], 'Recargar'],
  [['1', '2', '3', 'Q'], 'Cambiar de arma (3: cuchillo)'],
  [['Tab'], 'Marcador'],
  [['Esc'], 'Pausa'],
];

const loadChar = (): CharacterId | null => {
  try {
    const id = localStorage.getItem(CHAR_KEY);
    return isCharacterId(id) ? id : null;
  } catch {
    return null;
  }
};
const loadSkins = (): SkinChoice => {
  try {
    return (JSON.parse(localStorage.getItem(SKINS_KEY) ?? 'null') as SkinChoice | null) ?? {};
  } catch {
    return {};
  }
};

interface LastDeath {
  name: string;
  char: CharacterId | null;
  weapon: string;
  hp: number;
}
type MatchState = MatchEnd & { at: number };
type Menu = 'settings' | 'manual' | null;

export default function Game({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const settings = useSettings();
  const [hud, setHud] = useState<HudState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [showScores, setShowScores] = useState(false);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [charId, setCharId] = useState(loadChar);
  const [skins, setSkins] = useState(loadSkins); // chosen skin for each character
  const [selecting, setSelecting] = useState(true); // the character is chosen when entering
  const [menu, setMenu] = useState<Menu>(null);
  const [banner, setBanner] = useState<KillBanner | null>(null); // centre notice when you kill someone
  const [lastDeath, setLastDeath] = useState<LastDeath | null>(null); // who killed you
  const [shake, setShake] = useState('');
  const { room, you } = session;
  const map = getMap(room.mapId, room.size);
  const live = useRef({ hud, match, menu });
  live.current = { hud, match, menu };

  const info: RoomView = {
    name: room.name,
    map: map.name,
    size: map.sizeName,
    players: hud?.players.length || 1,
    max: room.max,
  };

  useEffect(() => {
    if (!mount.current) return undefined;
    const e = new Engine(mount.current, socket, you, setHud, getMap(room.mapId, room.size), room.mode, room.scoreLimit);
    engine.current = e;
    return () => e.destroy();
  }, [you, room.mapId, room.size, room.mode, room.scoreLimit]);

  // Safety net: if something tries to close the tab mid-game (Ctrl+W, F5…), the browser asks first
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  // While choosing a character there is no automatic respawn
  useEffect(() => {
    if (engine.current)
      engine.current.autoChar = selecting || !charId ? null : { id: charId, skin: skins[charId] ?? 'base' };
  }, [selecting, charId, skins]);

  // Block curtain when spawning / respawning
  const wasAlive = useRef(false);
  useEffect(() => {
    if (hud?.alive && !wasAlive.current) playCurtain();
    wasAlive.current = !!hud?.alive;
  }, [hud?.alive]);

  // Soft shake when taking damage (can be turned off in Settings)
  const lastDamage = useRef(0);
  useEffect(() => {
    const k = hud?.damageKey;
    if (!k || k === lastDamage.current) return undefined;
    lastDamage.current = k;
    if (!settings.shake || !hud.alive) return undefined;
    setShake((s) => (s === 'shake-a' ? 'shake-b' : 'shake-a'));
    const t = setTimeout(() => setShake(''), SHAKE_MS);
    return () => clearTimeout(t);
  }, [hud?.damageKey, hud?.alive, settings.shake]);

  useEffect(() => {
    type NewFeedItem = FeedItem extends infer F ? (F extends FeedItem ? Omit<F, 'key' | 't'> : never) : never;
    const push = (item: NewFeedItem) =>
      setFeed((f) => [...f.slice(-(FEED_MAX - 1)), { ...item, key: ++feedId, t: Date.now() } as FeedItem]);
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    const onKill = (d: KillEvent) => {
      push({ type: 'kill', ...d });
      const label = STREAKS[d.streak];
      if (label) push({ type: 'streak', name: d.killerName, team: d.killerTeam, label, n: d.streak });
      if (d.ended) push({ type: 'notice', text: `${d.killerName} acabó con la racha de ${d.victimName} (${d.ended})` });
      if (d.victim === you) setLastDeath({ name: d.killerName, char: d.killerChar, weapon: d.weapon, hp: d.killerHp });
      if (d.killer === you) {
        if (label || d.reward) sfx.streak();
        clearTimeout(bannerTimer);
        setBanner({ key: Date.now(), name: d.victimName, head: d.head, label, n: d.streak, reward: d.reward });
        bannerTimer = setTimeout(() => setBanner(null), BANNER_MS);
      }
    };
    const onNotice = (text: string) => push({ type: 'notice', text });
    const onEnd = (d: MatchEnd) => setMatch({ ...d, at: Date.now() });
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
    // Each killfeed line lasts 6 s (it fades during the last 300 ms)
    const prune = setInterval(() => setFeed((f) => f.filter((x) => Date.now() - x.t < FEED_LIFE_MS)), FEED_PRUNE_MS);

    const down = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScores(true);
      }
      const { hud: h, match: m, menu: open } = live.current;
      // Esc on the pause screen: back to the game (same as clicking)
      if (e.code === 'Escape' && !e.repeat && h?.alive && !h.locked && !m && !open) {
        engine.current?.requestLock();
        return;
      }
      // O: settings · H or F1: manual
      const want: Menu = e.code === 'KeyO' ? 'settings' : e.code === 'KeyH' || e.code === 'F1' ? 'manual' : null;
      if (want && !e.repeat) {
        e.preventDefault();
        setMenu((cur) => (cur === want ? null : want));
        document.exitPointerLock?.();
        return;
      }
      // T: switch team (team modes)
      if (e.code === 'KeyT' && !e.repeat && canSwitchTeam(room.mode) && h?.myTeam && !m && !open) {
        socket.emit('team:set', { team: 3 - h.myTeam });
      }
      // B: change character, only while dead (applied on respawn)
      if (e.code === 'KeyB' && h?.everSpawned && !h.alive && !m && !open) {
        setSelecting(true);
        document.exitPointerLock?.();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Tab' && setShowScores(false);
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
  }, [onLeave, you, room.mode]);

  const pick = (characterId: CharacterId, skin: SkinId) => {
    const next = { ...skins, [characterId]: skin };
    try {
      localStorage.setItem(CHAR_KEY, characterId);
      localStorage.setItem(SKINS_KEY, JSON.stringify(next));
    } catch {}
    setCharId(characterId);
    setSkins(next);
    setSelecting(false);
    engine.current?.requestLock(); // must happen inside the click
    engine.current?.spawn(characterId, skin); // spawns now, or when the countdown ends
  };
  const keep = () => {
    setSelecting(false);
    engine.current?.requestLock();
  };
  const leave = () => {
    socket.emit('room:leave');
    onLeave();
  };
  const switchTeam = (team: SideTeam) => socket.emit('team:set', { team });

  const alive = hud?.alive;
  const dead = hud && !alive && hud.everSpawned && !selecting && !match;
  const choosing = hud && !alive && selecting && !match;
  const paused = hud && alive && !hud.locked && !match && !menu;
  const me = charId ? CHAR_BY_ID[charId] : null;
  const killer = lastDeath?.char ? CHAR_BY_ID[lastDeath.char] : null;
  const sec = hud ? Math.ceil(hud.respawnIn / 1000) : 0;
  const otherTeam = hud?.myTeam === 1 ? 2 : 1;

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
            <h2>
              {lastDeath ? (
                <>
                  Te eliminó <span className="k">{lastDeath.name}</span>
                </>
              ) : (
                '¡Nueva partida!'
              )}
            </h2>
            {lastDeath && killer && (
              <div className="killer-chip">
                <span className="chip-char" style={{ '--c': killer.color }}>
                  {killer.name}
                </span>
                <span>
                  {lastDeath.weapon} · le quedaban <b>{lastDeath.hp}</b> de vida
                </span>
              </div>
            )}
            <div className="countdown">
              <b key={sec}>{Math.max(1, sec)}</b>
            </div>
            <div className="pbar fill">
              <i key={hud.deathKey} style={{ animationDuration: `${PLAYER.respawnDelay}ms` }} />
            </div>
            {me && (
              <div className="as">
                Reapareces como{' '}
                <span className="chip-char" style={{ '--c': me.color }}>
                  {me.name}
                </span>
              </div>
            )}
            <button className="btn has-key" onClick={() => setSelecting(true)}>
              <span className="key">B</span>Cambiar personaje
            </button>
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
          onTeam={switchTeam}
        />
      )}

      {paused && (
        <div className="pause-bg" onClick={() => engine.current?.requestLock()}>
          <div className="stage">
            <div className="pause-panel">
              <h2>Pausa</h2>
              <p className="sub">
                <b>Haz clic o pulsa Esc para volver</b> · los demás siguen jugando
              </p>
              <div className="key-grid">
                {PAUSE_KEYS.map(([keys, what]) => (
                  <div className="key-row" key={what}>
                    <Keys keys={keys} />
                    <span>{what}</span>
                  </div>
                ))}
              </div>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn has-key" onClick={() => setMenu('settings')}>
                  <span className="key">O</span>Ajustes
                </button>
                <button className="btn has-key" onClick={() => setMenu('manual')}>
                  <span className="key">H</span>Manual
                </button>
                {canSwitchTeam(room.mode) && hud.myTeam && (
                  <button className="btn has-key" onClick={() => switchTeam(otherTeam)}>
                    <span className="key">T</span>Pasar a {teamName(room.mode, otherTeam)}
                  </button>
                )}
                <button className="btn ghost danger" onClick={leave}>
                  Salir de la sala
                </button>
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
                <h2 style={{ color: match.team ? TEAM_TXT[match.team] : 'var(--sol)' }}>
                  ¡{match.winner} gana la partida!
                </h2>
                <div className="sub">
                  Nueva partida en unos segundos…
                  <div className="pbar fill">
                    <i key={match.at} style={{ animationDuration: `${match.restartIn}ms` }} />
                  </div>
                </div>
                {match.best.length > 0 && (
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
            <Scoreboard
              players={hud.players}
              me={you}
              info={info}
              scoreLimit={room.scoreLimit}
              mode={room.mode}
              teamScore={hud.teamScore}
            />
          </div>
        </div>
      )}

      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'manual' && <Manual onClose={() => setMenu(null)} />}
    </div>
  );
}
