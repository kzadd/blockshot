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
    <div className="modal-bg" onClick={onClose}>
      <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Panel de admin</h2>
          <span className="esc">Solo en el PC del servidor · Esc para cerrar</span>
          <button className="btn icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="admin-room">
          <button className="btn sm" onClick={act(() => socket.emit('admin:restart'))}>
            <Icon name="rotate" />
            Reiniciar partida
          </button>
          <button className="btn sm" onClick={act(() => socket.emit('admin:end'))}>
            <Icon name="flag" />
            Terminar ya
          </button>
          <button
            className={`btn sm ${room.closed ? 'on' : 'ghost'}`}
            onClick={() => socket.emit('admin:lock', { locked: !room.closed })}
            title="Cerrada: nadie nuevo puede entrar a mitad de partida"
          >
            <Icon name={room.closed ? 'lock' : 'unlock'} />
            {room.closed ? 'Sala cerrada' : 'Sala abierta'}
          </button>
          <span className="admin-move">
            <select
              className="input"
              value={mapId}
              onChange={(e) => setMapId(e.target.value as MapId)}
              aria-label="Mapa"
            >
              {MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as ModeId)}
              aria-label="Modo"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              className="btn sm"
              disabled={mapId === room.mapId && mode === room.mode}
              onClick={act(() => socket.emit('admin:room', { mapId, mode }))}
            >
              <Icon name="layers" />
              Cambiar ahora
            </button>
          </span>
        </div>

        <TournamentPanel room={room} you={you} admin onStart={onClose} />

        {/* Practice bots and the session statistics */}
        <div className="admin-room">
          <span className="kicker">
            <Icon name="bot" />
            Bots de práctica
          </span>
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
          <button className="btn sm" onClick={() => socket.emit('bot:add', { level })}>
            <Icon name="plus" />
            Añadir bot
          </button>
          <button className="btn sm ghost" onClick={() => socket.emit('bot:clear')}>
            <Icon name="x" />
            Quitar bots
          </button>
          <button className="btn sm ghost admin-stats" onClick={onStats}>
            <Icon name="chart" />
            Estadísticas de la sesión
          </button>
        </div>

        <div className="stats-body">
          <table className="sb-table">
            <thead>
              <tr>
                <th>Jugador</th>
                {teams && <th style={{ width: 110 }}>Equipo</th>}
                <th className="num">Bajas</th>
                <th className="num">Muertes</th>
                <th className="num">Ping</th>
                <th style={{ width: 300 }} />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.n}
                    {p.id === you && <small className="admin-you"> · tú</small>}
                  </td>
                  {teams && <td>{p.tm ? teamName(room.mode, p.tm) : '—'}</td>}
                  <td className="num k">{p.k}</td>
                  <td className="num">{p.d}</td>
                  <td className="num">{p.pg}</td>
                  <td className="admin-acts">
                    <button className="btn sm ghost" onClick={() => socket.emit('admin:kill', { id: p.id })}>
                      <Icon name="skull" />
                      Matar
                    </button>
                    {canSwitchTeam(room.mode) && (
                      <button className="btn sm ghost" onClick={() => socket.emit('admin:team', { id: p.id })}>
                        <Icon name="users" />
                        Cambiar
                      </button>
                    )}
                    {p.id !== you && (
                      <button className="btn sm ghost danger" onClick={() => kick(p.id)}>
                        <Icon name="logout" />
                        {confirmKick === p.id ? '¿Seguro?' : 'Expulsar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
