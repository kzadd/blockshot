// Room control (server PC only): every player with kill / switch team / kick, and the room itself: restart or
// end the match, move it to another map and mode now, and close it so nobody joins mid-match.
import { useEffect, useState } from 'react';
import {
  BOT_LEVELS,
  MAPS,
  MODES,
  canSwitchTeam,
  isTeamMode,
  teamName,
  type BotLevel,
  type MapId,
  type ModeId,
  type RoomInfo,
} from '@blockshot/shared';
import { socket } from '../../network/socket';
import { Icon } from '../../ui/icons';
import { useHud } from '../hud/hudStore';
import { teamVar } from '../hud/teamStyle';
import { TournamentPanel } from './TournamentDialog';

interface Props {
  room: RoomInfo;
  you: string;
  onStats: () => void;
  onClose: () => void;
}

export default function AdminDialog({ room, you, onStats, onClose }: Props) {
  const players = useHud((s) => s.players) ?? [];
  const [mapId, setMapId] = useState<MapId>(room.mapId);
  const [mode, setMode] = useState<ModeId>(room.mode);
  const [level, setLevel] = useState<BotLevel>('normal');
  // Kicking is final for this room: ask once (second click within a few seconds)
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const teams = isTeamMode(room.mode);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  useEffect(() => {
    if (!confirmKick) return undefined;
    const t = setTimeout(() => setConfirmKick(null), 3000);
    return () => clearTimeout(t);
  }, [confirmKick]);

  const kick = (id: string) => {
    if (confirmKick !== id) return setConfirmKick(id);
    socket.emit('admin:kick', { id });
    setConfirmKick(null);
  };
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="pz pz-layer dim wins" onClick={onClose}>
      <div
        className="win admin-win"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="aw-head">
          <div>
            <h1 className="title" id="admin-title">
              Panel de admin
            </h1>
            <p className="meta">Solo en el PC del servidor · {room.name}</p>
          </div>
          <button className="btn sm" onClick={onClose}>
            Cerrar <kbd className="k">Esc</kbd>
          </button>
        </header>

        <div className="aw-body">
          {/* The room: the match, where it is played, practice bots and the tournament */}
          <div className="aw-side">
            <section>
              <h2 className="lbl">Partida</h2>
              <div className="aw-row">
                <button className="btn sm" onClick={act(() => socket.emit('admin:restart'))}>
                  <Icon name="rotate" />
                  Reiniciar
                </button>
                <button className="btn sm" onClick={act(() => socket.emit('admin:end'))}>
                  <Icon name="flag" />
                  Terminar ya
                </button>
              </div>
              <div className="set">
                <span>Sala cerrada</span>
                <button
                  className={`toggle ${room.closed ? 'on' : ''}`}
                  role="switch"
                  aria-checked={room.closed}
                  aria-label="Sala cerrada"
                  onClick={() => socket.emit('admin:lock', { locked: !room.closed })}
                />
                <small>Nadie nuevo puede entrar a mitad de partida</small>
              </div>
            </section>

            <section>
              <h2 className="lbl">Mapa y modo</h2>
              <div className="aw-row">
                <select value={mapId} onChange={(e) => setMapId(e.target.value as MapId)} aria-label="Mapa">
                  {MAPS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select value={mode} onChange={(e) => setMode(e.target.value as ModeId)} aria-label="Modo">
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn sm"
                disabled={mapId === room.mapId && mode === room.mode}
                onClick={act(() => socket.emit('admin:room', { mapId, mode }))}
              >
                <Icon name="layers" />
                Cambiar ahora
              </button>
            </section>

            <section>
              <h2 className="lbl">Bots de práctica</h2>
              <div className="seg sm" role="radiogroup" aria-label="Nivel del bot">
                {(Object.keys(BOT_LEVELS) as BotLevel[]).map((l) => (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={level === l}
                    className={level === l ? 'on' : ''}
                    onClick={() => setLevel(l)}
                  >
                    {BOT_LEVELS[l].name}
                  </button>
                ))}
              </div>
              <div className="aw-row">
                <button className="btn sm" onClick={() => socket.emit('bot:add', { level })}>
                  <Icon name="plus" />
                  Añadir bot
                </button>
                <button className="btn sm" onClick={() => socket.emit('bot:clear')}>
                  <Icon name="x" />
                  Quitar bots
                </button>
              </div>
            </section>

            <TournamentPanel room={room} you={you} admin onStart={onClose} />
          </div>

          <section className="aw-players">
            <div className="aw-ph">
              <h2 className="lbl">Jugadores · {players.length}</h2>
              <button className="btn sm" onClick={onStats}>
                <Icon name="chart" />
                Estadísticas de la sesión
              </button>
            </div>
            <div className="aw-scroll">
              <table className="tb">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    {teams && <th>Equipo</th>}
                    <th className="r">Bajas</th>
                    <th className="r">Muertes</th>
                    <th className="r">Ping</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} className={p.id === you ? 'you' : ''}>
                      <td className="nm">
                        {p.n}
                        {p.id === you && <small className="meta"> · tú</small>}
                      </td>
                      {teams && (
                        <td>
                          {p.tm ? (
                            <span className="aw-team" style={{ '--t': teamVar(p.tm) }}>
                              {teamName(room.mode, p.tm)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td className="r">{p.k}</td>
                      <td className="r">{p.d}</td>
                      <td className="r">{p.pg}</td>
                      <td>
                        <div className="aw-acts">
                          <button className="btn sm" onClick={() => socket.emit('admin:kill', { id: p.id })}>
                            <Icon name="skull" />
                            Matar
                          </button>
                          {canSwitchTeam(room.mode) && (
                            <button className="btn sm" onClick={() => socket.emit('admin:team', { id: p.id })}>
                              <Icon name="users" />
                              Cambiar
                            </button>
                          )}
                          {p.id !== you && (
                            <button className="btn sm danger" onClick={() => kick(p.id)}>
                              <Icon name="logout" />
                              {confirmKick === p.id ? '¿Seguro?' : 'Expulsar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
