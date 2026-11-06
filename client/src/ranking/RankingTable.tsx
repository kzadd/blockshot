// The parts of the ranking both the lobby screen and the in-game window show: your season card and the table.
// Markup and classes are the approved proposal's (styles/proposal.css).
import type { CSSProperties } from 'react';
import { DEFAULT_OUTFIT_COLOR, WEAPONS, rankOf, seasonPoints, type RankingRow, type WeaponId } from '@blockshot/shared';
import { RankBadge, rankInk } from '../ui/badges';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const kd = (r: RankingRow) => (r.kills / Math.max(1, r.deaths)).toFixed(2);
/** The rank: its badge, its name in the tier's colour and the season points («Oro I · 443»). */
function Rank({ row, size }: { row: RankingRow; size: number }) {
  const pts = seasonPoints(row);
  const r = rankOf(pts);
  return (
    <span className="rk">
      <RankBadge points={pts} size={size} />
      <span>
        <b style={{ color: rankInk(r.tier) }}>{r.label}</b>
        <small>{pts} pts</small>
      </span>
    </span>
  );
}
/** The colour a row is drawn in: the outfit last worn, else the default outfit colour. */
export const rowColor = (r: RankingRow) => r.favColor || DEFAULT_OUTFIT_COLOR;
/** The most-carried primary, if it is still a weapon of the game (old records may name something else). */
export const favWeapon = (r: RankingRow): WeaponId | null => (r.fav && r.fav in WEAPONS ? r.fav : null);
export const favName = (r: RankingRow) => {
  const w = favWeapon(r);
  return w ? WEAPONS[w].name : '—';
};
export const pc = (color: string) => ({ '--pc': color }) as CSSProperties;

/** Your position and season numbers, and how far the next place is. */
export function YouCard({ rows, you }: { rows: RankingRow[]; you: string }) {
  const i = rows.findIndex((r) => r.name === you);
  const me = rows[i];
  if (!me)
    return (
      <div className="me-card" style={pc('var(--line)')}>
        <div className="me-pos">
          <span className="lbl">Tu puesto</span>
          <b>—</b>
        </div>
        <p className="meta">Termina una partida para entrar en el ranking.</p>
      </div>
    );
  const ahead = rows[i - 1];
  const need = ahead ? ahead.wins - me.wins + 1 : 0;
  return (
    <div className="me-card" style={pc(rowColor(me))}>
      <div className="me-pos">
        <span className="lbl">Tu puesto</span>
        <b>#{i + 1}</b>
      </div>
      <dl>
        {(
          [
            ['Rango', <Rank key="rk" row={me} size={46} />],
            ['Victorias', me.wins],
            ['% victorias', pct(me.wins, me.matches)],
            ['K/D', kd(me)],
            ['Precisión', pct(me.hits, me.shots)],
            ['Favorito', favName(me)],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="meta">
        {ahead ? (
          <>
            {need === 1 ? 'Te falta' : 'Te faltan'} <b>{need}</b> {need === 1 ? 'victoria' : 'victorias'} para pasar a{' '}
            {ahead.name}.
          </>
        ) : (
          'Vas primero. Defiende el puesto.'
        )}
      </p>
    </div>
  );
}

export function RankTable({ rows, you }: { rows: RankingRow[]; you: string }) {
  return (
    <table className="tb">
      <thead>
        <tr>
          <th>#</th>
          <th>Jugador</th>
          <th>Arma favorita</th>
          <th>Rango</th>
          <th className="r">Victorias</th>
          <th className="r">Partidas</th>
          <th className="r">K/D</th>
          <th className="r">Precisión</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.name} className={r.name === you ? 'you' : undefined}>
            <td className="pos">{i + 1}</td>
            <td className="nm">
              {r.name}
              {r.name === you && (
                <>
                  {' '}
                  <span className="chip">Tú</span>
                </>
              )}
            </td>
            <td>
              {favWeapon(r) && <span className="sw" style={{ background: rowColor(r) }} />}
              {favName(r)}
            </td>
            <td>
              <Rank row={r} size={30} />
            </td>
            <td className="r">{r.wins}</td>
            <td className="r">{r.matches}</td>
            <td className="r">{kd(r)}</td>
            <td className="r">{pct(r.hits, r.shots)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
