// Session statistics (server PC only): who plays what and how well, since the server started. The share of lives
// per primary weapon at the top is the quick balance check: one gun far above the rest is the one to look at.
import { useEffect, useState } from 'react';
import { WEAPONS, type SessionStatsRow, type WeaponId } from '@blockshot/shared';
import { socket } from '../../network/socket';

const REFRESH_MS = 3000;

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const entries = (picks: SessionStatsRow['picks']) =>
  (Object.entries(picks) as [WeaponId, number | undefined][]).filter(
    (e): e is [WeaponId, number] => !!e[1] && e[1] > 0 && e[0] in WEAPONS,
  );
const favourite = (r: SessionStatsRow): WeaponId | null => entries(r.picks).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

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

  // Lives per primary weapon over every player: only the guns somebody carried, most carried first
  const totals = new Map<WeaponId, number>();
  for (const r of rows ?? []) for (const [id, n] of entries(r.picks)) totals.set(id, (totals.get(id) ?? 0) + n);
  const picks = [...totals].sort((a, b) => b[1] - a[1]);
  const totalPicks = picks.reduce((n, [, v]) => n + v, 0);

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
          <h2 className="lbl">Armas principales elegidas</h2>
          {picks.length === 0 ? (
            <p className="meta">Todavía nadie ha salido a jugar.</p>
          ) : (
            <div className="st-picks">
              {picks.map(([id, n]) => (
                <div key={id} className="st-pick">
                  <span className="aw-team">{WEAPONS[id].name}</span>
                  <b>{pct(n, totalPicks)}</b>
                  <span className="bar">
                    <i style={{ width: `${(n / totalPicks) * 100}%` }} />
                  </span>
                  <small className="meta">
                    {n} {n === 1 ? 'vida' : 'vidas'}
                  </small>
                </div>
              ))}
            </div>
          )}
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
                        <td>{fav ? <span className="aw-team">{WEAPONS[fav].name}</span> : '—'}</td>
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
