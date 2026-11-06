import { useEffect, useRef, useState } from 'react';
import {
  MODE_BY_ID,
  STREAKS,
  canSwitchTeam,
  getMap,
  type KillEvent,
  type MatchEnd,
  type SideTeam,
  type RoomInfo,
} from '@blockshot/shared';
import type { Session } from '../app/App';
import { saveClass, type Look } from '../characters/looks';
import Controls from '../manual/Manual';
import { markGameLost, markKicked } from '../network/connection';
import { socket } from '../network/socket';
import Settings from '../settings/SettingsDialog';
import { useSettings } from '../settings/settingsStore';
import { Icon } from '../ui/icons';
import { playCurtain } from '../ui/ui';
import { sfx } from './audio/sound';
import { Engine } from './engine/Engine';
import HUD, { type FeedItem, type KillBanner } from './hud/HUD';
import { hudStore, publishHud, resetHud, useHud } from './hud/hudStore';
import Meeting from './hud/Meeting';
import type { RoomView } from './roomView';
import CharacterScreen from './screens/CharacterScreen';
import DeathScreen, { type LastDeath } from './screens/DeathScreen';
import LoadoutMenu from './screens/LoadoutMenu';
import PauseMenu from './screens/PauseMenu';
import AdminDialog from './screens/AdminDialog';
import StatsDialog from './screens/StatsDialog';
import RankingDialog from '../ranking/RankingDialog';
import TournamentDialog from './screens/TournamentDialog';
import ScoresLayer, { type MatchState } from './screens/ScoresLayer';

let feedId = 0;

/** Killfeed keeps the last few lines, each for FEED_LIFE_MS (fading out from FEED_FADE_AT_MS). */
const FEED_MAX = 5;
const FEED_LIFE_MS = 6000;
const FEED_FADE_AT_MS = 5700;
const FEED_PRUNE_MS = 300;
const BANNER_MS = 2300;
const SHAKE_MS = 170;

type Menu = 'settings' | 'controls' | 'stats' | 'admin' | 'ranking' | 'tour' | 'loadout' | null;
type NewFeedItem = FeedItem extends infer F ? (F extends FeedItem ? Omit<F, 'key' | 't'> : never) : never;

interface GameProps {
  session: Session;
  onLeave: () => void;
  /** the room moved to another map / mode (end of match vote) */
  onRoom: (room: RoomInfo) => void;
}

export default function Game({ session, onLeave, onRoom }: GameProps) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const settings = useSettings();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [showScores, setShowScores] = useState(false);
  const [match, setMatch] = useState<MatchState | null>(null);
  // The class in play (weapons, ability and looks; null until the first «Jugar»). The saved one lives in
  // characters/looks (localStorage)
  const [playing, setPlaying] = useState<Look | null>(null);
  const [selecting, setSelecting] = useState(true); // the class is built when entering
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
    meeting: !!s.traitor?.meeting,
  }));
  const live = useRef({ match, menu });
  live.current = { match, menu };
  const resume = useRef({ selecting, playing });
  // New map or mode after a vote: a light "click to start" instead of the pause menu (the browser needs a click)
  const [fresh, setFresh] = useState(false);
  resume.current = { selecting, playing };

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
    const keep = resume.current;
    if (!keep.selecting && keep.playing) {
      e.autoChar = keep.playing;
      e.respawnSoon();
      setFresh(true);
    }
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
    if (engine.current) engine.current.autoChar = selecting ? null : playing;
  }, [selecting, playing]);

  // Block curtain when spawning / respawning
  const wasAlive = useRef(false);
  useEffect(() => {
    if (g?.alive && !wasAlive.current) playCurtain();
    wasAlive.current = !!g?.alive;
  }, [g?.alive]);

  // Traidores: a meeting frees the mouse to vote
  useEffect(() => {
    if (g?.meeting) document.exitPointerLock?.();
  }, [g?.meeting]);

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
      // killer === victim: an unscored death (the void, camping, the admin) named by killerName
      const self = d.killer === d.victim;
      if (d.victim === you)
        setLastDeath({ name: d.killerName, cls: self ? null : d.killerClass, weapon: d.weapon, hp: d.killerHp, self });
      if (d.killer === you && !self) {
        if (label || d.reward) sfx.streak();
        clearTimeout(bannerTimer);
        setBanner({
          key: Date.now(),
          name: d.victimName,
          head: d.head,
          label,
          n: d.streak,
          reward: d.reward,
          medals: d.medals,
        });
        bannerTimer = setTimeout(() => setBanner(null), BANNER_MS);
      }
    };
    const onNotice = (text: string) => push({ type: 'notice', text });
    const onEnd = (d: MatchEnd) => setMatch({ ...d, at: Date.now(), votes: d.vote.map(() => 0), myVote: null });
    const onVotes = (votes: number[]) => setMatch((m) => (m ? { ...m, votes } : m));
    const onStart = () => {
      setMatch(null);
      setLastDeath(null);
    };
    // Connection lost mid-game: back to the lobby, which explains it and reconnects
    const onDisc = () => {
      markGameLost();
      onLeave();
    };
    const onKicked = (reason: string) => {
      markKicked(reason);
      onLeave();
    };
    socket.on('kill', onKill);
    socket.on('notice', onNotice);
    socket.on('vote', onVotes);
    socket.on('room:changed', onRoom);
    socket.on('match:end', onEnd);
    socket.on('match:start', onStart);
    socket.on('disconnect', onDisc);
    socket.on('kicked', onKicked);
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
      // L (or Esc while it is open): the in-match loadout menu, over the game; the mouse is freed meanwhile
      if (!e.repeat && open === 'loadout' && (e.code === 'Escape' || e.code === 'KeyL')) {
        e.preventDefault();
        setMenu(null);
        if (h?.alive) engine.current?.requestLock();
        return;
      }
      if (e.code === 'KeyL' && !e.repeat && h?.everSpawned && resume.current.playing && !m && !open) {
        if (!resume.current.selecting || h.alive) {
          e.preventDefault();
          setMenu('loadout');
          document.exitPointerLock?.();
          return;
        }
      }
      // Esc on the pause screen: back to the game (same as clicking)
      if (e.code === 'Escape' && !e.repeat && h?.alive && !h.locked && !m && !open) {
        engine.current?.requestLock();
        return;
      }
      // O: settings · H or F1: controls · P: admin panel (server PC only)
      const want: Menu =
        e.code === 'KeyO'
          ? 'settings'
          : e.code === 'KeyH' || e.code === 'F1'
            ? 'controls'
            : e.code === 'KeyP' && session.admin
              ? 'admin'
              : null;
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
      socket.off('vote', onVotes);
      socket.off('room:changed', onRoom);
      socket.off('match:end', onEnd);
      socket.off('match:start', onStart);
      socket.off('disconnect', onDisc);
      socket.off('kicked', onKicked);
      clearInterval(prune);
      clearTimeout(bannerTimer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onLeave, onRoom, you, room.mode, session.admin]);

  const pick = (look: Look) => {
    saveClass(look);
    setPlaying(look);
    setSelecting(false);
    engine.current?.requestLock(); // must happen inside the click
    engine.current?.spawn(look); // spawns now, or when the countdown ends
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
  // In-match loadout menu: the new class is kept (here and on the server) for the next respawn
  const saveLoadout = (look: Look) => {
    saveClass(look);
    setPlaying(look);
    const { primary, secondary, ability, accessory } = look;
    socket.emit('player:class', { primary, secondary, ability, accessory });
    setMenu(null);
    if (hudStore.getState().hud?.alive) engine.current?.requestLock();
  };
  const closeLoadout = () => {
    setMenu(null);
    if (hudStore.getState().hud?.alive) engine.current?.requestLock();
  };
  const vote = (i: number) => {
    socket.emit('vote', { i });
    setMatch((m) => (m ? { ...m, myVote: i } : m));
  };

  const ready = !!g;
  const dead = ready && !g.alive && g.everSpawned && !selecting && !match;
  const choosing = ready && !g.alive && selecting && !match;
  const paused = ready && g.alive && !g.locked && !match && !menu && !g.meeting;
  useEffect(() => {
    if (g?.locked) setFresh(false);
  }, [g?.locked]);

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
          current={playing}
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
          current={playing}
          mode={room.mode}
          onPick={pick}
          onKeep={keep}
          onLeave={leave}
          onTeam={switchTeam}
          you={you}
        />
      )}

      {paused && fresh && (
        <div className="click-start" onClick={() => engine.current?.requestLock()}>
          <div className="cs-card">
            <span className="kicker">Siguiente partida</span>
            <b>
              {map.name} · {MODE_BY_ID[room.mode].name}
            </b>
            <span className="cs-hint">
              <Icon name="crosshair" size={16} />
              Haz clic para empezar
            </span>
          </div>
        </div>
      )}

      {paused && !fresh && (
        <PauseMenu
          mode={room.mode}
          onResume={() => engine.current?.requestLock()}
          onSettings={() => setMenu('settings')}
          onControls={() => setMenu('controls')}
          onSwitchTeam={switchTeam}
          onLeave={leave}
          admin={!!session.admin}
          onAdmin={() => setMenu('admin')}
          onRanking={() => setMenu('ranking')}
          onTour={() => setMenu('tour')}
        />
      )}

      {ready && g.meeting && !match && (
        <Meeting you={you} onVoted={() => hudStore.getState().hud?.alive && engine.current?.requestLock()} />
      )}

      {ready && (showScores || match) && (
        <ScoresLayer
          match={match}
          you={you}
          info={info}
          scoreLimit={room.scoreLimit}
          mode={room.mode}
          onLeave={leave}
          onVote={vote}
        />
      )}

      {menu === 'loadout' && playing && (
        <LoadoutMenu
          current={playing}
          mode={room.mode}
          alive={!!g?.alive}
          onSave={saveLoadout}
          onClose={closeLoadout}
        />
      )}
      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'stats' && <StatsDialog onClose={() => setMenu(null)} />}
      {menu === 'admin' && (
        <AdminDialog room={room} you={you} onStats={() => setMenu('stats')} onClose={() => setMenu(null)} />
      )}
      {menu === 'ranking' && <RankingDialog admin={!!session.admin} onClose={() => setMenu(null)} />}
      {menu === 'controls' && (
        <div className="pz pz-layer">
          <Controls onClose={() => setMenu(null)} />
        </div>
      )}
      {menu === 'tour' && (
        <TournamentDialog room={room} you={you} admin={!!session.admin} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
