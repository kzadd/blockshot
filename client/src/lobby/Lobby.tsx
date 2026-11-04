import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { MAPS, MAP_SIZES, MODE_BY_ID, NICKNAME_MAX, type JoinResult, type RoomSummary } from '@blockshot/shared';
import type { Session } from '../app/App';
import { sfx } from '../game/audio/sound';
import { clearGameLost, useConnection } from '../network/connection';
import { socket } from '../network/socket';
import { RankingScreen } from '../ranking/RankingScreen';
import { SettingsPanels } from '../settings/SettingsDialog';
import { Icon } from '../ui/icons';
import Modal from '../ui/Modal';
import { blurredMap, mapImage } from './mapImage';
import CreateRoom, { Lock, type RoomForm } from './CreateRoom';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

// The lobby is the approved proposal (.impeccable/mocks/propuesta: index.html + proto.js) with live data: same
// markup, classes and texts, styled by styles/proposal.css under the `.pz` root.

const NICK_KEY = 'blockshot:nick';
/** Show the "cannot connect" toast after this long without a connection. */
const OFFLINE_NOTICE_MS = 3000;
/** The backdrop dims while the map changes (proposal's setMap). */
const SWAP_MS = 180;
const LOGO = `${import.meta.env.BASE_URL}brand/blockshot-logo-transparente.svg`;
const WRONG_PASS = 'Contraseña incorrecta. Pídesela a quien creó la sala.';

const loadNick = (): string => {
  try {
    return localStorage.getItem(NICK_KEY) || '';
  } catch {
    return '';
  }
};

type Screen = 'jugar' | 'ranking' | 'ajustes';
const SCREENS: [Screen, string][] = [
  ['jugar', 'Jugar'],
  ['ranking', 'Ranking'],
  ['ajustes', 'Ajustes'],
];
const screenFromHash = (): Screen => SCREENS.find(([id]) => `#${id}` === location.hash)?.[0] ?? 'jugar';
type Tab = 'salas' | 'crear';

function Toast({
  title,
  sub,
  onClick,
  children,
}: {
  title: string;
  sub: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="toast under-bar" role="alert" onClick={onClick}>
      <span className="bang">
        <Icon name="alert" size={18} />
      </span>
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      {children}
    </div>
  );
}

export default function Lobby({ onJoined }: { onJoined: (s: Session) => void }) {
  const [nick, setNick] = useState(loadNick);
  const [nickError, setNickError] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const connected = useConnection((c) => c.status === 'connected');
  const lostGame = useConnection((c) => c.lostGame);
  const kicked = useConnection((c) => c.kicked);
  const [offline, setOffline] = useState(false); // connection error notice
  const [form, setForm] = useState<RoomForm>({
    name: '',
    password: '',
    mapId: MAPS[0]!.id,
    size: 'm',
    mode: 'ffa',
    scoreLimit: MODE_BY_ID.ffa.def,
    max: MAP_SIZES.m.players,
  });
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [tab, setTab] = useState<Tab | null>(null);
  const [locked, setLocked] = useState<RoomSummary | null>(null); // room whose password is being asked
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [toast, setToast] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [swap, setSwap] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);

  // The top tabs are links (#jugar, #ranking, #ajustes) like in the proposal
  useEffect(() => {
    const route = () => setScreen(screenFromHash());
    addEventListener('hashchange', route);
    return () => removeEventListener('hashchange', route);
  }, []);

  useEffect(() => {
    socket.on('rooms', setRooms);
    if (connected) socket.emit('rooms:list', setRooms); // also on every reconnection
    return () => {
      socket.off('rooms', setRooms);
    };
  }, [connected]);

  // If there is no connection after a few seconds, show a notice with «Reintentar»
  useEffect(() => {
    if (connected) {
      setOffline(false);
      return undefined;
    }
    const t = setTimeout(() => setOffline(true), OFFLINE_NOTICE_MS);
    return () => clearTimeout(t);
  }, [connected]);

  // The chosen map, blurred, behind every page; it dims a moment while it changes
  useEffect(() => {
    let live = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    void blurredMap(form.mapId).then((url) => {
      if (!live) return;
      setSwap(true);
      t = setTimeout(() => {
        setBackdrop(url);
        setSwap(false);
      }, SWAP_MS);
    });
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [form.mapId]);

  const nickname = nick.trim();
  const needNick = () => {
    if (nickname) {
      try {
        localStorage.setItem(NICK_KEY, nickname);
      } catch {}
      return false;
    }
    setNickError(true);
    nickRef.current?.focus();
    return true;
  };

  const handle = (res: JoinResult) => {
    if (res.ok) onJoined(res);
    else setToast(res.error || 'No se pudo entrar a la sala.');
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    sfx.unlock();
    if (needNick()) return;
    socket.emit('room:create', { ...form, nickname }, handle);
  };

  const join = (room: RoomSummary, password = '') => {
    sfx.unlock();
    if (needNick() || room.players >= room.max) return;
    if (room.locked && !password) {
      if (locked) setPassError(WRONG_PASS);
      else {
        setPass('');
        setPassError('');
        setLocked(room);
      }
      return;
    }
    socket.emit('room:join', { roomId: room.id, password, nickname }, (res) => {
      if (res.ok) onJoined(res);
      else if (room.locked && res.error === 'Contraseña incorrecta.') setPassError(WRONG_PASS);
      else if (room.locked) setPassError(res.error || 'No se pudo entrar a la sala.');
      else setToast(res.error || 'No se pudo entrar a la sala.');
    });
  };

  // Opens on the room list when there are rooms and on «Crear sala» when there are none
  const shown: Tab = tab ?? (rooms.length ? 'salas' : 'crear');
  return (
    <>
      <div className="pz">
        <div
          className={`backdrop ${swap ? 'swap' : ''}`}
          aria-hidden="true"
          style={backdrop ? ({ '--bgmap': `url(${backdrop})` } as CSSProperties) : undefined}
        />
        <div className="app">
          <header className="bar">
            <a className="logo" href="#jugar">
              <img src={LOGO} alt="BLOCKSHOT" />
            </a>
            <nav className="tabs" aria-label="Pantallas">
              {SCREENS.map(([id, name]) => (
                <a key={id} href={`#${id}`} className={screen === id ? 'on' : ''}>
                  {name}
                </a>
              ))}
            </nav>
            <label className="nick">
              <span>Tu nombre</span>
              <input
                ref={nickRef}
                value={nick}
                maxLength={NICKNAME_MAX}
                aria-invalid={nickError}
                onChange={(e) => {
                  setNick(e.target.value);
                  setNickError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              {nickError && (
                <div className="bubble-error" role="alert">
                  <Icon name="alert" />
                  <b>Escribe tu nombre antes de entrar</b>
                </div>
              )}
            </label>
          </header>

          {screen === 'jugar' && (
            <main className="screen jugar">
              <section className="panel lobby">
                <div className="ptabs" role="tablist">
                  <button role="tab" aria-selected={shown === 'salas'} onClick={() => setTab('salas')}>
                    Salas abiertas <b>{rooms.length}</b>
                  </button>
                  <button role="tab" aria-selected={shown === 'crear'} onClick={() => setTab('crear')}>
                    Crear sala
                  </button>
                </div>
                <div className="lt" hidden={shown !== 'salas'}>
                  <div className="rooms">
                    {rooms.map((r) => {
                      const full = r.players >= r.max;
                      return (
                        <div className="room" key={r.id}>
                          <img src={mapImage(r.mapId)} alt="" />
                          <div>
                            <div className="nm">
                              {r.name}
                              {r.locked && <Lock />}
                            </div>
                            <span className="meta">
                              {r.map} · {r.mode}
                            </span>
                          </div>
                          <div className="who">
                            <span>
                              <b>{r.players}</b>
                              <span className="meta"> / {r.max} jugadores</span>
                            </span>
                            <span className="fill">
                              <i style={{ width: `${(r.players / r.max) * 100}%` }} />
                            </span>
                          </div>
                          <span className={`state ${full ? 'full' : 'play'}`}>{full ? 'Llena' : 'En partida'}</span>
                          <div className="join">
                            <button className="btn primary" disabled={full || !connected} onClick={() => join(r)}>
                              {full ? 'Llena' : 'Unirse'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="lobby-foot">
                    <span className="meta">
                      {connected ? 'Las salas de la red del aula aparecen aquí solas.' : 'Conectando con el servidor…'}
                    </span>
                    <button className="btn" onClick={() => setTab('crear')}>
                      Crear sala
                    </button>
                  </div>
                </div>
                <CreateRoom
                  form={form}
                  setForm={setForm}
                  hidden={shown !== 'crear'}
                  connected={connected}
                  nickname={nickname}
                  onSubmit={create}
                />
              </section>
            </main>
          )}
          {screen === 'ranking' && <RankingScreen you={nickname} />}
          {screen === 'ajustes' && (
            <main className="screen ajustes">
              <SettingsPanels />
            </main>
          )}
        </div>

        {locked && (
          <Modal
            labelledBy="passTitle"
            onClose={() => setLocked(null)}
            onSubmit={(e) => {
              e.preventDefault();
              join(locked, pass);
            }}
          >
            <h2 id="passTitle">{locked.name}</h2>
            <p className="meta">
              {locked.map} · {locked.mode} · {locked.players}/{locked.max} jugadores. Esta sala tiene contraseña.
            </p>
            <label>
              <span className="lbl">Contraseña</span>
              <input
                type="password"
                autoComplete="off"
                autoFocus
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setPassError('');
                }}
              />
            </label>
            <p className="err" role="alert" hidden={!passError}>
              {passError}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setLocked(null)}>
                Cancelar
              </button>
              <button className="btn primary" disabled={!connected}>
                Entrar
              </button>
            </div>
          </Modal>
        )}
      </div>

      {offline && !connected && (
        <Toast title="No se pudo conectar con el servidor" sub="Reintentando automáticamente…">
          <button className="btn sm" onClick={() => socket.connect()}>
            Reintentar
          </button>
        </Toast>
      )}
      {kicked && connected && !toast && <Toast title={kicked} sub="Toca para cerrar" onClick={clearGameLost} />}
      {lostGame && connected && !toast && !kicked && (
        <Toast
          title="Se perdió la conexión con la sala"
          sub="Ya estás conectado de nuevo: vuelve a entrar · Toca para cerrar"
          onClick={clearGameLost}
        />
      )}
      {toast && connected && <Toast title={toast} sub="Toca para cerrar" onClick={() => setToast('')} />}
    </>
  );
}
