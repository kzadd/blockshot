// Session statistics (server PC only): who plays what and how well, since the server started. The character
// share at the top is the quick balance check: one character far above the rest is the one to look at.
import { useEffect, useState } from 'react';
import { CHARACTERS, CHAR_BY_ID, type CharacterId, type SessionStatsRow } from '@blockshot/shared';
import { socket } from '../../network/socket';
import { Icon } from '../../ui/icons';

const REFRESH_MS = 3000;

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const favourite = (r: SessionStatsRow): CharacterId | null => {
  const best = Object.entries(r.picks).sort((a, b) => b[1] - a[1])[0];
  return best ? (best[0] as CharacterId) : null;
};

export default function StatsDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<SessionStatsRow[] | null>(null);

  useEffect(() => {
    const load = () => socket.emit('admin:stats', setRows);
    load();
    const t = setInterval(load, REFRESH_MS);
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const picks = Object.fromEntries(
    CHARACTERS.map((c) => [c.id, (rows ?? []).reduce((n, r) => n + (r.picks[c.id] ?? 0), 0)]),
  ) as Record<CharacterId, number>;
  const totalPicks = Object.values(picks).reduce((a, b) => a + b, 0);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Estadísticas de la sesión</h2>
          <span className="esc">Desde que se encendió el servidor · todas las salas</span>
          <button className="btn icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="stats-picks">
          {CHARACTERS.map((c) => (
            <div key={c.id} className="stats-pick" style={{ '--c': c.color }}>
              <span className="chip-char" style={{ '--c': c.color }}>
                {c.name}
              </span>
              <b>{pct(picks[c.id], totalPicks)}</b>
              <span className="bar">
                <i style={{ width: totalPicks ? `${(picks[c.id] / totalPicks) * 100}%` : 0 }} />
              </span>
              <small>
                {picks[c.id]} {picks[c.id] === 1 ? 'vez' : 'veces'}
              </small>
            </div>
          ))}
        </div>

        <div className="stats-body">
          {!rows ? (
            <p className="stats-empty">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="stats-empty">Todavía nadie ha jugado.</p>
          ) : (
            <table className="sb-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th style={{ width: 140 }}>Más usa</th>
                  <th className="num">Bajas</th>
                  <th className="num">Muertes</th>
                  <th className="num">B/M</th>
                  <th className="num">Precisión</th>
                  <th className="num">A la cabeza</th>
                  <th className="num">Medallas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const fav = favourite(r);
                  return (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>
                        {fav ? (
                          <span className="chip-char" style={{ '--c': CHAR_BY_ID[fav].color }}>
                            {CHAR_BY_ID[fav].name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num k">{r.kills}</td>
                      <td className="num">{r.deaths}</td>
                      <td className="num">{(r.kills / Math.max(1, r.deaths)).toFixed(1)}</td>
                      <td className="num">{pct(r.hits, r.shots)}</td>
                      <td className="num">{r.heads}</td>
                      <td className="num">{r.medals}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
