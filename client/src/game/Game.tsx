import { useEffect, useRef, useState } from 'react';
import {
  STREAKS,
  canSwitchTeam,
  getMap,
  isCharacterId,
  type CharacterId,
  type KillEvent,
  type MatchEnd,
  type SideTeam,
  type SkinId,
} from '@blockshot/shared';
import type { Session } from '../app/App';
import type { SkinChoice } from '../characters/CharacterSelect';
import Manual from '../manual/Manual';
import { markGameLost } from '../network/connection';
import { socket } from '../network/socket';
import Settings from '../settings/SettingsDialog';
import { useSettings } from '../settings/settingsStore';
import { playCurtain } from '../ui/ui';
import { sfx } from './audio/sound';
import { Engine } from './engine/Engine';
import HUD, { type FeedItem, type KillBanner } from './hud/HUD';
import { hudStore, publishHud, resetHud, useHud } from './hud/hudStore';
import type { RoomView } from './roomView';
import CharacterScreen from './screens/CharacterScreen';
import DeathScreen, { type LastDeath } from './screens/DeathScreen';
import PauseMenu from './screens/PauseMenu';
import ScoresLayer, { type MatchState } from './screens/ScoresLayer';

let feedId = 0;

const CHAR_KEY = 'blockshot:char';
const SKINS_KEY = 'blockshot:skins';
/** Killfeed keeps the last few lines, each for FEED_LIFE_MS (fading out from FEED_FADE_AT_MS). */
const FEED_MAX = 5;
const FEED_LIFE_MS = 6000;
const FEED_FADE_AT_MS = 5700;
const FEED_PRUNE_MS = 300;
const BANNER_MS = 2300;
const SHAKE_MS = 170;

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

type Menu = 'settings' | 'manual' | null;
type NewFeedItem = FeedItem extends infer F ? (F extends FeedItem ? Omit<F, 'key' | 't'> : never) : never;

export default function Game({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const settings = useSettings();
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
  // Only what decides which screen is shown: the HUD pieces subscribe to their own fields
  const g = useHud((s) => ({
    alive: s.alive,
    everSpawned: s.everSpawned,
    locked: s.locked,
    damageKey: s.damageKey,
    playerCount: s.players.length,
  }));
  const live = useRef({ match, menu });
  live.current = { match, menu };

  const info: RoomView = {
    name: room.name,
    map: map.name,
    size: map.sizeName,
    players: g?.playerCount || 1,
    max: room.max,
  };

  useEffect(() => {
    if (!mount.current) return undefined;
    const e = new Engine(
      mount.current,
      socket,
      you,
      publishHud,
      getMap(room.mapId, room.size),
      room.mode,
      room.scoreLimit,
    );
    engine.current = e;
    return () => {
      e.destroy();
      resetHud();
    };
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
    if (g?.alive && !wasAlive.current) playCurtain();
    wasAlive.current = !!g?.alive;
  }, [g?.alive]);

  // Soft shake when taking damage (can be turned off in Settings)
  const lastDamage = useRef(0);
  useEffect(() => {
    const k = g?.damageKey;
    if (!k || k === lastDamage.current) return undefined;
    lastDamage.current = k;
    if (!settings.shake || !g.alive) return undefined;
    setShake((s) => (s === 'shake-a' ? 'shake-b' : 'shake-a'));
    const t = setTimeout(() => setShake(''), SHAKE_MS);
    return () => clearTimeout(t);
  }, [g?.damageKey, g?.alive, settings.shake]);

  useEffect(() => {
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
    // Connection lost mid-game: back to the lobby, which explains it and reconnects
    const onDisc = () => {
      markGameLost();
      onLeave();
    };
    socket.on('kill', onKill);
    socket.on('notice', onNotice);
    socket.on('match:end', onEnd);
    socket.on('match:start', onStart);
    socket.on('disconnect', onDisc);
    // Each killfeed line lasts 6 s (it fades during the last 300 ms)
    // Only a new state when a line starts fading or goes away (no re-render otherwise)
    const prune = setInterval(() => {
      setFeed((f) => {
        const now = Date.now();
        let changed = false;
        const next = f.flatMap((x) => {
          const age = now - x.t;
          if (age >= FEED_LIFE_MS) {
            changed = true;
            return [];
          }
          if (!x.out && age > FEED_FADE_AT_MS) {
            changed = true;
            return [{ ...x, out: true }];
          }
          return [x];
        });
        return changed ? next : f;
      });
    }, FEED_PRUNE_MS);

    const down = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScores(true);
      }
      const h = hudStore.getState().hud;
      const { match: m, menu: open } = live.current;
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

  const ready = !!g;
  const dead = ready && !g.alive && g.everSpawned && !selecting && !match;
  const choosing = ready && !g.alive && selecting && !match;
  const paused = ready && g.alive && !g.locked && !match && !menu;

  return (
    <div className={`game ${shake}`}>
      <div className="canvas" ref={mount} />

      {ready && !choosing && !dead && (
        <HUD
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
        <DeathScreen
          lastDeath={lastDeath}
          current={charId}
          feed={feed}
          you={you}
          mode={room.mode}
          info={info}
          onChangeCharacter={() => setSelecting(true)}
        />
      )}

      {choosing && (
        <CharacterScreen
          info={info}
          current={charId}
          skins={skins}
          mode={room.mode}
          onPick={pick}
          onKeep={keep}
          onLeave={leave}
          onTeam={switchTeam}
        />
      )}

      {paused && (
        <PauseMenu
          mode={room.mode}
          onResume={() => engine.current?.requestLock()}
          onSettings={() => setMenu('settings')}
          onManual={() => setMenu('manual')}
          onSwitchTeam={switchTeam}
          onLeave={leave}
        />
      )}

      {ready && (showScores || match) && (
        <ScoresLayer match={match} you={you} info={info} scoreLimit={room.scoreLimit} mode={room.mode} />
      )}

      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'manual' && <Manual onClose={() => setMenu(null)} />}
    </div>
  );
}
