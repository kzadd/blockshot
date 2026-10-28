import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  MAPS,
  MAP_SIZES,
  MODES,
  MODE_BY_ID,
  NICKNAME_MAX,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  type JoinResult,
  type MapId,
  type ModeId,
  type RoomSummary,
  type SizeId,
} from '@blockshot/shared';
import type { Session } from '../app/App';
import { sfx } from '../game/audio/sound';
import { clearGameLost, useConnection } from '../network/connection';
import { socket } from '../network/socket';
import { RankingScreen } from '../ranking/RankingScreen';
import { SettingsPanels } from '../settings/SettingsDialog';
import { Icon } from '../ui/icons';
import Modal from '../ui/Modal';
import { blurredMap, mapImage } from './mapImage';
import { MODE_HOW, MODE_ICON, MODE_SUB } from './modeCopy';
import '../styles/proposal.css';
import '../styles/pz-extra.css';

// The lobby is the approved proposal (.impeccable/mocks/propuesta: index.html + proto.js) with live data: same
// markup, classes and texts, styled by styles/proposal.css under the `.pz` root.

const NICK_KEY = 'blockshot:nick';
/** Show the "cannot connect" toast after this long without a connection. */
const OFFLINE_NOTICE_MS = 3000;
/** More players than this × the size's recommendation gets a warning. */
const CROWDED_FACTOR = 1.5;
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

interface RoomForm {
  name: string;
  password: string;
  mapId: MapId;
  size: SizeId;
  mode: ModeId;
  scoreLimit: number;
  max: number;
}

type Screen = 'jugar' | 'ranking' | 'ajustes';
const SCREENS: [Screen, string][] = [
  ['jugar', 'Jugar'],
  ['ranking', 'Ranking'],
  ['ajustes', 'Ajustes'],
];
const screenFromHash = (): Screen => SCREENS.find(([id]) => `#${id}` === location.hash)?.[0] ?? 'jugar';
type Tab = 'salas' | 'crear';

const ModeIcon = ({ id }: { id: ModeId }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MODE_ICON[id] }} />
);
const Lock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z" />
  </svg>
);

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
  const map = MAPS.find((m) => m.id === form.mapId) ?? MAPS[0]!;
  const mode = MODE_BY_ID[form.mode];
  const size = MAP_SIZES[form.size];
  const crowded = form.max > size.players * CROWDED_FACTOR;
  const placeholder = `SALA DE ${(nickname || 'tu clase').toUpperCase()}`;
  const summary: [string, ReactNode][] = [
    ['Sala', (form.name.trim() || placeholder).toUpperCase()],
    ['Mapa', `${map.name} · ${size.name}`],
    ['Modo', mode.name],
    ['Para ganar', `${form.scoreLimit} ${mode.unit}`],
    ['Jugadores', crowded ? `Hasta ${form.max} · recomendado ${size.players}` : `Hasta ${form.max}`],
    [
      'Acceso',
      form.password.trim() ? (
        <>
          <Lock /> Con contraseña
        </>
      ) : (
        'Libre'
      ),
    ],
  ];

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
                <form className="lt create" hidden={shown !== 'crear'} onSubmit={create}>
                  <div className="c-left">
                    <h2 className="lbl">Mapa</h2>
                    <div className="maps">
                      {MAPS.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={`map ${form.mapId === m.id ? 'on' : ''}`}
                          onClick={() => setForm({ ...form, mapId: m.id })}
                        >
                          <img src={mapImage(m.id)} alt="" />
                          <span>{m.name}</span>
                        </button>
                      ))}
                    </div>
                    <h2 className="lbl">Modo de juego</h2>
                    <div className="modes">
                      {MODES.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={`mode ${form.mode === m.id ? 'on' : ''}`}
                          onClick={() => setForm({ ...form, mode: m.id, scoreLimit: m.def })}
                        >
                          <ModeIcon id={m.id} />
                          <span>
                            {m.name}
                            <small>{MODE_SUB[m.id]}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="rules">
                      <div>
                        <h2 className="lbl">Para ganar</h2>
                        <div className="seg">
                          {mode.limits.map((n) => (
                            <button
                              type="button"
                              key={n}
                              className={form.scoreLimit === n ? 'on' : ''}
                              onClick={() => setForm({ ...form, scoreLimit: n })}
                            >
                              {n} {mode.unit}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h2 className="lbl">Tamaño</h2>
                        <div className="seg">
                          {Object.values(MAP_SIZES).map((z) => (
                            <button
                              type="button"
                              key={z.id}
                              className={form.size === z.id ? 'on' : ''}
                              onClick={() => setForm({ ...form, size: z.id, max: z.players })}
                            >
                              {z.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h2 className="lbl">Jugadores</h2>
                        <div className="stepper">
                          <button
                            type="button"
                            aria-label="Menos"
                            disabled={form.max <= ROOM_MIN_PLAYERS}
                            onClick={() => setForm({ ...form, max: form.max - 1 })}
                          >
                            −
                          </button>
                          <b>{form.max}</b>
                          <button
                            type="button"
                            aria-label="Más"
                            disabled={form.max >= ROOM_MAX_PLAYERS}
                            onClick={() => setForm({ ...form, max: form.max + 1 })}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="c-right">
                    <div className="preview">
                      <img src={mapImage(map.id)} alt="" />
                      <div>
                        <b>{map.name}</b>
                        <span className="chip">
                          <ModeIcon id={mode.id} />
                          {mode.name}
                        </span>
                        <p className="meta">
                          {map.desc} {MODE_HOW[mode.id]}
                        </p>
                      </div>
                    </div>
                    <div className="two">
                      <label>
                        <span className="lbl">Nombre de la sala</span>
                        <input
                          className="upper"
                          value={form.name}
                          maxLength={24}
                          placeholder={placeholder}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="lbl">Contraseña · opcional</span>
                        <input
                          value={form.password}
                          maxLength={32}
                          placeholder="Vacía: entra cualquiera"
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </label>
                    </div>
                    <div>
                      <h2 className="lbl">Resumen</h2>
                      <dl className="summary">
                        {summary.map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <button className="btn primary wide" disabled={!connected}>
                      Crear y entrar
                    </button>
                  </div>
                </form>
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
