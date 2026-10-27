// All-time ranking (saved by the server between sessions): most wins first. The admin can start a new season;
// the old one is kept as a file on the server.
import { useEffect, useState } from 'react';
import type { RankingRow } from '@blockshot/shared';
import { socket } from '../network/socket';
import { Icon } from '../ui/icons';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

export default function RankingDialog({ admin, onClose }: { admin: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    socket.emit('ranking:get', setRows);
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const reset = () => {
    if (!confirm) return setConfirm(true);
    socket.emit('admin:ranking:reset');
    setConfirm(false);
    setRows([]);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Ranking</h2>
          <span className="esc">Todas las partidas terminadas · se guarda entre clases</span>
          {admin && (
            <button className={`btn sm ${confirm ? 'danger' : 'ghost'}`} onClick={reset}>
              <Icon name="rotate" />
              {confirm ? '¿Empezar de cero?' : 'Nueva temporada'}
            </button>
          )}
          <button className="btn icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="stats-body">
          {!rows ? (
            <p className="stats-empty">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="stats-empty">Todavía no ha terminado ninguna partida.</p>
          ) : (
            <table className="sb-table">
              <thead>
                <tr>
                  <th className="num" style={{ width: 44 }}>
                    #
                  </th>
                  <th>Jugador</th>
                  <th className="num">Victorias</th>
                  <th className="num">Partidas</th>
                  <th className="num">% victorias</th>
                  <th className="num">Bajas</th>
                  <th className="num">B/M</th>
                  <th className="num">Precisión</th>
                  <th className="num">A la cabeza</th>
                  <th className="num">Medallas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name} className={i < 3 ? `podium p${i + 1}` : ''}>
                    <td className="num">{i + 1}</td>
                    <td>{r.name}</td>
                    <td className="num k">{r.wins}</td>
                    <td className="num">{r.matches}</td>
                    <td className="num">{pct(r.wins, r.matches)}</td>
                    <td className="num">{r.kills}</td>
                    <td className="num">{(r.kills / Math.max(1, r.deaths)).toFixed(1)}</td>
                    <td className="num">{pct(r.hits, r.shots)}</td>
                    <td className="num">{r.heads}</td>
                    <td className="num">{r.medals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
