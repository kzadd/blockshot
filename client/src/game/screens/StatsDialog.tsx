// Session statistics (server PC only): who plays what and how well, since the server started. The character
// share at the top is the quick balance check: one character far above the rest is the one to look at.
import { useEffect, useState } from 'react';
import { CHARACTERS, CHAR_BY_ID, type CharacterId, type SessionStatsRow } from '@blockshot/shared';
import { socket } from '../../network/socket';

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
    <div className="pz pz-layer dim wins" onClick={onClose}>
      <div
        className="win stats-win"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="aw-head">
          <div>
            <h1 className="title" id="stats-title">
              Estadísticas de la sesión
            </h1>
            <p className="meta">Desde que se encendió el servidor · todas las salas</p>
          </div>
          <button className="btn sm" onClick={onClose}>
            Cerrar <kbd className="k">Esc</kbd>
          </button>
        </header>

        <section>
          <h2 className="lbl">Personajes elegidos</h2>
          <div className="st-picks">
            {CHARACTERS.map((c) => (
              <div key={c.id} className="st-pick" style={{ '--t': c.color }}>
                <span className="aw-team">{c.name}</span>
                <b>{pct(picks[c.id], totalPicks)}</b>
                <span className="bar">
                  <i style={{ width: totalPicks ? `${(picks[c.id] / totalPicks) * 100}%` : 0 }} />
                </span>
                <small className="meta">
                  {picks[c.id]} {picks[c.id] === 1 ? 'vez' : 'veces'}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="st-players">
          <h2 className="lbl">Jugadores</h2>
          <div className="aw-scroll">
            {!rows ? (
              <p className="meta st-empty">Cargando…</p>
            ) : rows.length === 0 ? (
              <p className="meta st-empty">Todavía nadie ha jugado.</p>
            ) : (
              <table className="tb">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Más usa</th>
                    <th className="r">Bajas</th>
                    <th className="r">Muertes</th>
                    <th className="r">B/M</th>
                    <th className="r">Precisión</th>
                    <th className="r">A la cabeza</th>
                    <th className="r">Medallas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const fav = favourite(r);
                    return (
                      <tr key={r.name}>
                        <td className="nm">{r.name}</td>
                        <td>
                          {fav ? (
                            <span className="aw-team" style={{ '--t': CHAR_BY_ID[fav].color }}>
                              {CHAR_BY_ID[fav].name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="r">{r.kills}</td>
                        <td className="r">{r.deaths}</td>
                        <td className="r">{(r.kills / Math.max(1, r.deaths)).toFixed(1)}</td>
                        <td className="r">{pct(r.hits, r.shots)}</td>
                        <td className="r">{r.heads}</td>
                        <td className="r">{r.medals}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
