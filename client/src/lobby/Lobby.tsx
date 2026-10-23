import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  MAPS,
  MAP_SIZES,
  MODES,
  MODE_BY_ID,
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
import Manual from '../manual/Manual';
import { socket } from '../network/socket';
import Settings from '../settings/SettingsDialog';
import { Slider } from '../ui/ui';
import MapPreview from './MapPreview';

const NICK_KEY = 'blockshot:nick';
/** Show the "cannot connect" toast after this long without a connection. */
const OFFLINE_NOTICE_MS = 3000;

const loadNick = (): string => {
  try {
    return localStorage.getItem(NICK_KEY) || '';
  } catch {
    return '';
  }
};

const MODE_SUB: Record<ModeId, string> = {
  ffa: 'Cada uno por su cuenta',
  teams: 'Rojo contra Azul',
  ctf: 'Roba la bandera rival',
  gungame: 'Un arma nueva por baja',
  kc: 'Recoge las placas de tus bajas',
  infect: 'Huye de los del cuchillo',
};
const EMPTY_COLORS = ['#3a4a6c', '#ffc93c', '#3a4a6c', '#3f7fe0', '#d0533a', '#3aa65a'];

interface RoomForm {
  name: string;
  password: string;
  mapId: MapId;
  size: SizeId;
  mode: ModeId;
  scoreLimit: number;
  max: number;
}

export default function Lobby({ onJoined }: { onJoined: (s: Session) => void }) {
  const [nick, setNick] = useState(loadNick);
  const [nickError, setNickError] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [offline, setOffline] = useState(false); // connection error notice
  const [form, setForm] = useState<RoomForm>({
    name: '',
    password: '',
    mapId: 'patio',
    size: 'm',
    mode: 'ffa',
    scoreLimit: MODE_BY_ID.ffa.def,
    max: MAP_SIZES.m.players,
  });
  const [joining, setJoining] = useState<RoomSummary | null>(null);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState<'settings' | 'manual' | null>(null);
  const roomNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onRooms = (r: RoomSummary[]) => setRooms(r);
    const onConn = () => {
      setConnected(true);
      setOffline(false);
      socket.emit('rooms:list', onRooms);
    };
    const onDisc = () => setConnected(false);
    socket.on('rooms', onRooms);
    socket.on('connect', onConn);
    socket.on('disconnect', onDisc);
    if (socket.connected) socket.emit('rooms:list', onRooms);
    return () => {
      socket.off('rooms', onRooms);
      socket.off('connect', onConn);
      socket.off('disconnect', onDisc);
    };
  }, []);

  // If there is no connection after a few seconds, show a notice with «Reintentar»
  useEffect(() => {
    if (connected) return undefined;
    const t = setTimeout(() => setOffline(true), OFFLINE_NOTICE_MS);
    return () => clearTimeout(t);
  }, [connected]);

  const nickname = nick.trim();
  const needNick = () => {
    if (nickname) {
      try {
        localStorage.setItem(NICK_KEY, nickname);
      } catch {}
      return false;
    }
    setNickError(true);
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
    if (needNick()) return;
    if (room.locked && !password) {
      setJoining(room);
      setPass('');
      setPassError('');
      return;
    }
    socket.emit('room:join', { roomId: room.id, password, nickname }, (res) => {
      if (res.ok) {
        setJoining(null);
        onJoined(res);
      } else if (password && /contraseña/i.test(res.error || ''))
        setPassError(`Contraseña incorrecta. Pídesela a ${room.host}.`);
      else {
        setJoining(null);
        setToast(res.error || 'No se pudo entrar a la sala.');
      }
    });
  };

  const mapInfo = MAPS.find((m) => m.id === form.mapId);
  const mode = MODE_BY_ID[form.mode];

  return (
    <div className="lobby">
      <div className="stage">
        <div className="lobby-inner">
          <header className="lobby-head">
            <div>
              <h1 className="logo">BLOCKSHOT</h1>
              <p>Arena de bloques para la clase. Crea una sala, comparte la contraseña y a jugar.</p>
            </div>
            <div className="head-actions">
              <label className="field" style={{ position: 'relative' }}>
                <span>Tu nombre</span>
                <input
                  className={`input ${nickError ? 'error' : ''}`}
                  value={nick}
                  maxLength={16}
                  placeholder="Ej. Ricardo"
                  onChange={(e) => {
                    setNick(e.target.value);
                    setNickError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && roomNameRef.current?.focus()}
                />
                {nickError && <span className="name-error">Escribe tu nombre antes de entrar.</span>}
              </label>
              <button className="btn" onClick={() => setMenu('manual')}>
                📖 Manual del juego
              </button>
              <button className="btn" onClick={() => setMenu('settings')}>
                ⚙️ Ajustes y mira
              </button>
            </div>
          </header>

          <div className="lobby-grid">
            <form className="panel create" onSubmit={create}>
              <h2 className="panel-title">Crear sala</h2>
              <div className="row-2">
                <label className="field">
                  <span>Nombre de la sala</span>
                  <input
                    ref={roomNameRef}
                    className="input"
                    value={form.name}
                    maxLength={24}
                    placeholder={`Sala de ${nickname || 'Ricardo'}`}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Contraseña (opcional)</span>
                  <span className="with-icon">
                    <i>{form.password ? '🔒' : '🔓'}</i>
                    <input
                      className="input"
                      value={form.password}
                      maxLength={32}
                      placeholder="Sin contraseña"
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </span>
                </label>
              </div>

              <div>
                <div className="label-row">
                  <span className="label">Mapa</span>
                  <span className="hint">{mapInfo?.desc}</span>
                </div>
                <div className="maps">
                  {MAPS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`map-card ${form.mapId === m.id ? 'on' : ''}`}
                      onClick={() => setForm({ ...form, mapId: m.id })}
                    >
                      <MapPreview mapId={m.id} size={form.size} px={48} className="map-thumb" />
                      <span>
                        <b>{m.name}</b>
                        <small>{m.tag}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label-row">
                  <span className="label">Modo de juego</span>
                </div>
                <div className="seg modes">
                  {MODES.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={form.mode === m.id ? 'on' : ''}
                      onClick={() => setForm({ ...form, mode: m.id, scoreLimit: m.def })}
                    >
                      <b>{m.name}</b>
                      <small>{MODE_SUB[m.id]}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="row-2">
                <div>
                  <div className="label-row">
                    <span className="label">Para ganar</span>
                    <span className="hint">
                      {form.mode === 'infect'
                        ? `Aguantar ${form.scoreLimit} min`
                        : `${form.scoreLimit} ${mode.unit}${form.mode === 'teams' || form.mode === 'kc' ? ' del equipo' : ''}`}
                    </span>
                  </div>
                  <div className="seg">
                    {mode.limits.map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={form.scoreLimit === n ? 'on' : ''}
                        onClick={() => setForm({ ...form, scoreLimit: n })}
                        style={{ justifyItems: 'center' }}
                      >
                        <b>{n}</b>
                        <small>{mode.unit}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="label-row">
                    <span className="label">Tamaño</span>
                  </div>
                  <div className="seg">
                    {Object.values(MAP_SIZES).map((z) => (
                      <button
                        type="button"
                        key={z.id}
                        className={form.size === z.id ? 'on' : ''}
                        onClick={() => setForm({ ...form, size: z.id, max: z.players })}
                      >
                        <b>{z.name}</b>
                        <small>{z.half * 2} m</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="create-foot">
                <Slider
                  label={`Jugadores máximos · ${ROOM_MIN_PLAYERS}–${ROOM_MAX_PLAYERS}`}
                  value={form.max}
                  min={ROOM_MIN_PLAYERS}
                  max={ROOM_MAX_PLAYERS}
                  onChange={(v) => setForm({ ...form, max: v })}
                />
                <button className="btn primary lg" disabled={!connected}>
                  Crear y entrar
                </button>
              </div>
            </form>

            <section className="panel rooms">
              <div className="rooms-head">
                <h2 className="panel-title">
                  Salas abiertas{rooms.length > 0 && <span className="count">{rooms.length}</span>}
                </h2>
                {connected ? (
                  <span className="status">
                    <i className="dot" /> Conectado
                  </span>
                ) : (
                  <span className="status off">
                    <i className="spin" /> Conectando…
                  </span>
                )}
              </div>
              {rooms.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">
                    {EMPTY_COLORS.map((c, i) => (
                      <i key={i} style={{ background: c }} />
                    ))}
                  </div>
                  <h3>Todavía no hay salas</h3>
                  <p>Crea la primera desde el panel de la izquierda y dile la contraseña a tu clase.</p>
                </div>
              ) : (
                <div className="room-list">
                  {rooms.map((r) => {
                    const full = r.players >= r.max;
                    return (
                      <div key={r.id} className={`room ${full ? 'full' : ''}`}>
                        <MapPreview mapId={r.mapId} size={r.sizeId} px={44} className="map-thumb" />
                        <div className="room-name">
                          <b>
                            {r.name}
                            {r.locked ? ' 🔒' : ''}
                          </b>
                          <small>
                            {r.map} · {r.size} · {r.mode} a {r.limit} · de {r.host}
                          </small>
                        </div>
                        <div className="room-count">
                          {r.players}/{r.max}
                          <div className="pbar">
                            <i style={{ width: `${(r.players / r.max) * 100}%` }} />
                          </div>
                        </div>
                        <button className="btn sm" disabled={full} onClick={() => join(r)}>
                          {full ? 'Llena' : 'Entrar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="rooms-note">La lista se actualiza sola. 🔒 = pide contraseña al entrar.</p>
            </section>
          </div>
        </div>
      </div>

      {joining && (
        <div className="modal-bg" onClick={() => setJoining(null)}>
          <form
            className="modal pass-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              join(joining, pass);
            }}
          >
            <div className="modal-head">
              <h2 style={{ fontSize: 20 }}>🔒 Sala con contraseña</h2>
              <button type="button" className="btn ghost icon" onClick={() => setJoining(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <p className="meta">
              <b>{joining.name}</b> · de {joining.host} · {joining.players}/{joining.max}
            </p>
            <label className="field">
              <span>Contraseña</span>
              <input
                autoFocus
                type="password"
                className={`input ${passError ? 'error' : ''}`}
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setPassError('');
                }}
              />
              {passError && <span className="field-error">{passError}</span>}
            </label>
            <div className="modal-foot">
              <button type="button" className="btn ghost md" onClick={() => setJoining(null)}>
                Cancelar
              </button>
              <button className="btn primary md" disabled={!pass}>
                Entrar
              </button>
            </div>
          </form>
        </div>
      )}

      {offline && !connected && (
        <div className="toast" role="alert">
          <span className="bang">!</span>
          <span>
            <b>No se pudo conectar con el servidor</b>
            <small>Reintentando automáticamente…</small>
          </span>
          <button className="btn sm" onClick={() => socket.connect()}>
            Reintentar
          </button>
        </div>
      )}
      {toast && connected && (
        <div className="toast" role="alert" onClick={() => setToast('')}>
          <span className="bang">!</span>
          <span>
            <b>{toast}</b>
            <small>Toca para cerrar</small>
          </span>
        </div>
      )}

      {menu === 'settings' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'manual' && <Manual onClose={() => setMenu(null)} />}
    </div>
  );
}
