import { CHAR_BY_ID, WEAPONS, isTeamMode, gunLadder, teamName } from '@blockshot/shared';

const TEAM_TXT = { 1: 'var(--eq-rojo-txt)', 2: 'var(--eq-azul-txt)' };

// caps = título de la columna de puntos propios (Capturas, Placas…) o nada
function Table({ players, me, numbered, caps, ladder }) {
  return (
    <table className="sb-table">
      <thead>
        <tr>
          {numbered && <th>#</th>}
          <th>Jugador</th>
          <th style={{ width: 130 }}>Personaje</th>
          {caps && (
            <th className="num" style={{ width: 80 }}>
              {caps}
            </th>
          )}
          {ladder && <th style={{ width: 150 }}>Arma</th>}
          <th className="num" style={{ width: 64 }}>
            Bajas
          </th>
          <th className="num" style={{ width: 72 }}>
            Muertes
          </th>
          <th className="num" style={{ width: 64 }}>
            Racha
          </th>
          <th className="num" style={{ width: 56 }}>
            Ping
          </th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.id} className={`${p.id === me ? 'me' : ''} ${i === 0 ? 'first' : ''}`}>
            {numbered && <td className="pos">{i + 1}</td>}
            <td>
              {p.n}
              {p.id === me && <span className="tag-sol you">TÚ</span>}
            </td>
            <td>
              {p.c ? (
                <span className="chip-char" style={{ '--c': CHAR_BY_ID[p.c].color }}>
                  {CHAR_BY_ID[p.c].name}
                </span>
              ) : (
                '—'
              )}
            </td>
            {caps && <td className="num k">{p.cp ?? 0}</td>}
            {ladder && (
              <td>
                {p.lv + 1}/{ladder.length} · {WEAPONS[ladder[Math.min(p.lv, ladder.length - 1)]].name}
              </td>
            )}
            <td className="num k">{p.k}</td>
            <td className="num">{p.d}</td>
            <td className={`num ${p.st >= 3 ? 'fire' : ''}`}>{p.st >= 3 ? `🔥 ${p.st}` : p.st}</td>
            <td className={`num ping ${p.pg > 120 ? 'bad' : ''}`}>{p.pg || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Scoreboard({ players, me, info, scoreLimit, mode, teamScore }) {
  const ladder = mode === 'gungame' ? gunLadder(scoreLimit) : null;
  const sorted = [...players].sort((a, b) => (ladder ? b.lv - a.lv : 0) || b.k - a.k || a.d - b.d);
  const teams = isTeamMode(mode);
  const infect = mode === 'infect';
  const caps = mode === 'ctf' ? 'Capturas' : mode === 'kc' ? 'Placas' : null;
  const goal = ladder
    ? `gana quien elimine con el cuchillo (${ladder.length} armas)`
    : mode === 'ctf'
      ? `gana el primer equipo en hacer ${scoreLimit} capturas`
      : mode === 'kc'
        ? `gana el primer equipo en recoger ${scoreLimit} placas`
        : infect
          ? `los supervivientes ganan si aguantan ${scoreLimit} min`
          : teams
            ? `gana el primer equipo en llegar a ${scoreLimit} bajas`
            : `gana quien llegue a ${scoreLimit} bajas`;
  return (
    <div className="scoreboard">
      <div className="sb-head">
        <h2>{info.name}</h2>
        <span>
          {info.map} · {info.size} · {goal}
        </span>
      </div>
      {teams ? (
        [1, 2].map((t) => (
          <div
            key={t}
            className="sb-team"
            style={{ '--t': `var(--eq-${t === 1 ? 'rojo' : 'azul'})`, '--tt': TEAM_TXT[t] }}
          >
            <div className="sb-team-head">
              <b>{infect ? teamName(mode, t) : `Equipo ${teamName(mode, t)}`}</b>
              <span>
                {infect
                  ? `${sorted.filter((p) => p.tm === t).length} ${sorted.filter((p) => p.tm === t).length === 1 ? 'jugador' : 'jugadores'}`
                  : `${teamScore?.[t] ?? 0} / ${scoreLimit}`}
              </span>
            </div>
            {!infect && (
              <div className="pbar">
                <i style={{ width: `${((teamScore?.[t] ?? 0) / scoreLimit) * 100}%` }} />
              </div>
            )}
            <Table players={sorted.filter((p) => p.tm === t)} me={me} caps={caps} />
          </div>
        ))
      ) : (
        <Table players={sorted} me={me} numbered ladder={ladder} />
      )}
    </div>
  );
}
