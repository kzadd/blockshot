import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { MODE_UI } from '../game/modeUi';
import Manual from '../manual/Manual';
import { clearGameLost, useConnection } from '../network/connection';
import { socket } from '../network/socket';
import Settings from '../settings/SettingsDialog';
import { Icon, MODE_ICON } from '../ui/icons';
import { mapImage } from './mapImage';

const NICK_KEY = 'blockshot:nick';
/** Show the "cannot connect" toast after this long without a connection. */
const OFFLINE_NOTICE_MS = 3000;
/** More players than this × the size's recommendation gets a warning. */
const CROWDED_FACTOR = 1.5;

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

type Tab = 'rooms' | 'create';

/** Two-by-two summary of a room (create preview and selected room). */
function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="lb-summary">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Lobby({ onJoined }: { onJoined: (s: Session) => void }) {
  const [nick, setNick] = useState(loadNick);
  const [nickError, setNickError] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const connected = useConnection((c) => c.status === 'connected');
  const lostGame = useConnection((c) => c.lostGame);
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
  const [tab, setTab] = useState<Tab | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState<'settings' | 'manual' | null>(null);
  const nickRef = useRef<HTMLInputElement>(null);

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

  const join = (room: RoomSummary) => {
    sfx.unlock();
    if (needNick() || room.players >= room.max) return;
    if (room.locked && !pass) return setPassError('Escribe la contraseña para entrar');
    socket.emit('room:join', { roomId: room.id, password: pass, nickname }, (res) => {
      if (res.ok) onJoined(res);
      else if (room.locked && /contraseña/i.test(res.error || ''))
        setPassError(`Contraseña incorrecta. Pídesela a ${room.host}`);
      else setToast(res.error || 'No se pudo entrar a la sala.');
    });
  };

  // Opens on the room list when there are rooms and on «Crear sala» when there are none
  const shown: Tab = tab ?? (rooms.length ? 'rooms' : 'create');
  const mapInfo = MAPS.find((m) => m.id === form.mapId);
  const mode = MODE_BY_ID[form.mode];
  const size = MAP_SIZES[form.size];
  const crowded = form.max > size.players * CROWDED_FACTOR;
  const sel = rooms.find((r) => r.id === selId) ?? rooms[0];
  const pick = (r: RoomSummary) => {
    setSelId(r.id);
    setPass('');
    setPassError('');
  };
  const bgMap = shown === 'rooms' && sel ? sel.mapId : form.mapId;

  return (
    <div className="lobby">
      <div className="menu-bg" style={{ backgroundImage: `url(${mapImage(bgMap)})` }} />
      <div className="stage">
        <header className="lb-nav">
          <div className="lb-logo">
            <span className="lb-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <h1>BLOCKSHOT</h1>
          </div>
          <div className="seg lb-tabs" role="tablist">
            <button role="tab" aria-selected={shown === 'rooms'} onClick={() => setTab('rooms')}>
              Salas abiertas
              <span className="lb-count">{rooms.length}</span>
            </button>
            <button role="tab" aria-selected={shown === 'create'} onClick={() => setTab('create')}>
              Crear sala
            </button>
          </div>
          <div className="lb-grow" />
          <label className="with-icon lb-nick">
            <Icon name="user" />
            <span className="sr-only">Tu nombre</span>
            <input
              ref={nickRef}
              className={`input ${nickError ? 'error' : ''}`}
              value={nick}
              maxLength={NICKNAME_MAX}
              placeholder="Tu nombre"
              onChange={(e) => {
                setNick(e.target.value);
                setNickError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            {nickError && (
              <span className="bubble-error" role="alert">
                <Icon name="alert" />
                <span>Escribe tu nombre antes de entrar</span>
              </span>
            )}
          </label>
          <button className="btn" onClick={() => setMenu('manual')}>
            <Icon name="book" size={18} />
            Manual
          </button>
          <button className="btn" onClick={() => setMenu('settings')}>
            <Icon name="sliders" size={18} />
            Ajustes y mira
          </button>
        </header>

        {shown === 'create' ? (
          <form className="lb-body" onSubmit={create}>
            <section className="panel lb-main">
              <div className="lb-step grow">
                <div className="lb-step-head">
                  <span className="lb-n">01</span>
                  <h2>Mapa</h2>
                  <span className="lb-hint">{mapInfo?.desc}</span>
                </div>
                <div className="lb-maps">
                  {MAPS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`lb-cell lb-map ${form.mapId === m.id ? 'on' : ''}`}
                      aria-pressed={form.mapId === m.id}
                      onClick={() => setForm({ ...form, mapId: m.id })}
                    >
                      <img src={mapImage(m.id)} alt="" />
                      <span className="lb-cell-text">
                        <b>{m.name}</b>
                        <small>{m.tag}</small>
                      </span>
                      {form.mapId === m.id && (
                        <span className="lb-check">
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lb-step">
                <div className="lb-step-head">
                  <span className="lb-n">02</span>
                  <h2>Modo de juego</h2>
                </div>
                <div className="lb-modes">
                  {MODES.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`lb-cell lb-mode ${form.mode === m.id ? 'on' : ''}`}
                      aria-pressed={form.mode === m.id}
                      onClick={() => setForm({ ...form, mode: m.id, scoreLimit: m.def })}
                    >
                      <Icon name={MODE_ICON[m.id]} size={22} />
                      <span className="lb-cell-text">
                        <b>{m.name}</b>
                        <small>{MODE_UI[m.id].sub}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lb-step">
                <div className="lb-step-head">
                  <span className="lb-n">03</span>
                  <h2>Reglas</h2>
                  <span className={`lb-hint ${crowded ? 'warn' : ''}`}>
                    {crowded
                      ? `Muchos jugadores para este tamaño · recomendado ${size.players}`
                      : `Recomendado para ${size.name.toLowerCase()}: ${size.players}`}
                  </span>
                </div>
                <div className="lb-rules">
                  <div className="lb-rule">
                    <div className="lb-rule-head">
                      <span>Para ganar</span>
                      <span>{mode.unit}</span>
                    </div>
                    <div className="seg">
                      {mode.limits.map((n) => (
                        <button
                          type="button"
                          key={n}
                          className="lb-num"
                          aria-pressed={form.scoreLimit === n}
                          onClick={() => setForm({ ...form, scoreLimit: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="lb-rule">
                    <div className="lb-rule-head">
                      <span>Tamaño</span>
                      <span>{size.half * 2} m</span>
                    </div>
                    <div className="seg">
                      {Object.values(MAP_SIZES).map((z) => (
                        <button
                          type="button"
                          key={z.id}
                          aria-pressed={form.size === z.id}
                          onClick={() => setForm({ ...form, size: z.id, max: z.players })}
                        >
                          {z.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="lb-rule">
                    <div className="lb-rule-head">
                      <span>Jugadores</span>
                      <span>
                        {ROOM_MIN_PLAYERS}–{ROOM_MAX_PLAYERS}
                      </span>
                    </div>
                    <div className="lb-stepper">
                      <button
                        type="button"
                        className="btn icon"
                        title="Menos"
                        disabled={form.max <= ROOM_MIN_PLAYERS}
                        onClick={() => setForm({ ...form, max: form.max - 1 })}
                      >
                        <Icon name="minus" />
                      </button>
                      <b>{form.max}</b>
                      <button
                        type="button"
                        className="btn icon"
                        title="Más"
                        disabled={form.max >= ROOM_MAX_PLAYERS}
                        onClick={() => setForm({ ...form, max: form.max + 1 })}
                      >
                        <Icon name="plus" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="panel lb-side">
              <span className="lb-kicker">Tu sala</span>
              <div className="lb-preview">
                <img src={mapImage(form.mapId)} alt="" />
                <span>{mapInfo?.name}</span>
              </div>
              <label className="field">
                <span>Nombre de la sala</span>
                <input
                  className="input"
                  value={form.name}
                  maxLength={24}
                  placeholder={`Sala de ${nickname || 'tu clase'}`}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Contraseña · opcional</span>
                <span className="with-icon">
                  <Icon name={form.password ? 'lock' : 'unlock'} />
                  <input
                    className="input"
                    value={form.password}
                    maxLength={32}
                    placeholder="Sin contraseña: entra cualquiera"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </span>
              </label>
              <Summary
                rows={[
                  ['Modo', mode.name],
                  ['Para ganar', MODE_UI[form.mode].hint(form.scoreLimit)],
                  ['Tamaño', `${size.name} · ${size.half * 2} m`],
                  ['Jugadores', `Hasta ${form.max}`],
                ]}
              />
              <button className="btn primary lg lb-cta" disabled={!connected}>
                Crear y entrar
              </button>
            </aside>
          </form>
        ) : (
          <div className={`lb-body ${sel ? '' : 'solo'}`}>
            <section className="panel lb-main">
              <div className="lb-list-head">
                <h2>Salas abiertas</h2>
                <span className={`lb-status ${connected ? '' : 'off'}`}>
                  <i />
                  {connected ? 'Conectado · se actualiza sola' : 'Conectando…'}
                </span>
              </div>
              {sel ? (
                <div className="lb-table" role="listbox" aria-label="Salas abiertas">
                  <div className="lb-row lb-th" aria-hidden="true">
                    <span>Sala</span>
                    <span>Modo</span>
                    <span>Tamaño</span>
                    <span>Jugadores</span>
                  </div>
                  <div className="lb-rows">
                    {rooms.map((r) => {
                      const full = r.players >= r.max;
                      return (
                        <div
                          key={r.id}
                          role="option"
                          tabIndex={0}
                          aria-selected={sel.id === r.id}
                          className={`lb-row ${sel.id === r.id ? 'on' : ''} ${full ? 'full' : ''}`}
                          onClick={() => pick(r)}
                          onDoubleClick={() => join(r)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') join(r);
                            if (e.key === ' ') {
                              e.preventDefault();
                              pick(r);
                            }
                          }}
                        >
                          <span className="lb-room">
                            <img src={mapImage(r.mapId)} alt="" />
                            <span className="lb-cell-text">
                              <b>
                                {r.name}
                                {r.locked && <Icon name="lock" size={14} className="lb-dim" />}
                              </b>
                              <small>
                                {r.map} · de {r.host}
                              </small>
                            </span>
                          </span>
                          <span className="lb-room-mode">
                            <Icon name={MODE_ICON[r.modeId]} />
                            {r.mode}
                          </span>
                          <span className="lb-room-size">{r.size}</span>
                          <span className="lb-players">
                            <b>
                              {r.players}/{r.max}
                            </b>
                            <i>
                              <i style={{ width: `${(r.players / r.max) * 100}%` }} />
                            </i>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="lb-empty">
                  <span className="lb-empty-art" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <h3>Todavía no hay salas</h3>
                  <p>Crea la primera y dile la contraseña a tu clase. Aparecerá aquí para todos.</p>
                  <button className="btn primary lg" onClick={() => setTab('create')}>
                    Crear sala
                  </button>
                </div>
              )}
            </section>

            {sel && (
              <aside className="panel lb-side">
                <span className="lb-kicker">Sala elegida</span>
                <div className="lb-preview">
                  <img src={mapImage(sel.mapId)} alt="" />
                </div>
                <div className="lb-room-title">
                  <h3>{sel.name}</h3>
                  <span>
                    {sel.map} · {sel.size} · de {sel.host}
                  </span>
                </div>
                <Summary
                  rows={[
                    ['Modo', sel.mode],
                    ['Para ganar', MODE_UI[sel.modeId].hint(sel.limit)],
                    ['Jugadores', `${sel.players} de ${sel.max}`],
                    ['Acceso', sel.locked ? 'Contraseña' : 'Libre'],
                  ]}
                />
                <div className="lb-side-foot">
                  {sel.locked && sel.players < sel.max && (
                    <label className="field lb-pass">
                      <span>Contraseña</span>
                      <input
                        type="password"
                        className={`input ${passError ? 'error' : ''}`}
                        value={pass}
                        placeholder={`Pídesela a ${sel.host}`}
                        onChange={(e) => {
                          setPass(e.target.value);
                          setPassError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && join(sel)}
                      />
                      {passError && (
                        <span className="field-error" role="alert">
                          {passError}
                        </span>
                      )}
                    </label>
                  )}
                  {sel.players < sel.max ? (
                    <button className="btn primary lg lb-cta" disabled={!connected} onClick={() => join(sel)}>
                      Entrar
                    </button>
                  ) : (
                    <button className="btn primary lg lb-cta" disabled>
                      Sala llena
                    </button>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {offline && !connected && (
        <div className="toast" role="alert">
          <span className="bang">
            <Icon name="alert" size={18} />
          </span>
          <span>
            <b>No se pudo conectar con el servidor</b>
            <small>Reintentando automáticamente…</small>
          </span>
          <button className="btn sm" onClick={() => socket.connect()}>
            Reintentar
          </button>
        </div>
      )}
      {lostGame && connected && !toast && (
        <div className="toast" role="alert" onClick={clearGameLost}>
          <span className="bang">
            <Icon name="alert" size={18} />
          </span>
          <span>
            <b>Se perdió la conexión con la sala</b>
            <small>Ya estás conectado de nuevo: vuelve a entrar · Toca para cerrar</small>
          </span>
        </div>
      )}
      {toast && connected && (
        <div className="toast" role="alert" onClick={() => setToast('')}>
          <span className="bang">
            <Icon name="alert" size={18} />
          </span>
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
