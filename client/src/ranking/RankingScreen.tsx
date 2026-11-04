// The all-time ranking, exactly as the approved proposal draws it (styles/proposal.css, inside a `.pz` root):
// the top three on a 3D podium, your season, then everyone. The lobby tab shows it under its top bar; in game
// RankingDialog shows it as a window with a close button.
import { useEffect, useState } from 'react';
import type { RankingRow } from '@blockshot/shared';
import { socket } from '../network/socket';
import '../styles/proposal.css';
import '../styles/pz-extra.css';
import Podium from './Podium';
import { RankTable, YouCard } from './RankingTable';

/** `admin`: the server PC, which may start a new season (the lobby does not know it yet, so it defaults off). */
export function RankingScreen({ you, admin = false, onClose }: { you: string; admin?: boolean; onClose?: () => void }) {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    socket.emit('ranking:get', setRows);
  }, []);

  const reset = () => {
    if (!confirm) return setConfirm(true);
    socket.emit('admin:ranking:reset');
    setConfirm(false);
    setRows([]);
  };

  const season = admin && (
    <button className="btn sm" onClick={reset}>
      {confirm ? '¿Empezar de cero?' : 'Nueva temporada · admin'}
    </button>
  );

  return (
    <main className="screen ranking">
      <section className="panel podium3d">
        <div className="headrow">
          <div>
            <h1 className="title">Ranking</h1>
            <p className="meta">Temporada actual · ordenado por victorias y, a igualdad, por bajas.</p>
          </div>
          {onClose ? (
            <div className="rk-acts">
              {season}
              <button className="btn sm" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : (
            season
          )}
        </div>
        <Podium top={rows?.slice(0, 3) ?? []} />
      </section>
      <section className="panel rank-side">
        {!rows ? (
          <p className="meta">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="meta">Todavía no ha terminado ninguna partida. Juega una y aparecerás aquí.</p>
        ) : (
          <>
            <YouCard rows={rows} you={you} />
            <RankTable rows={rows} you={you} />
          </>
        )}
      </section>
    </main>
  );
}
