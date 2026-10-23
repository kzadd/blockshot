import { CHAR_BY_ID, TEAMS } from '../../../shared/config.js';

const TEAM_TXT = { 1: 'var(--eq-rojo-txt)', 2: 'var(--eq-azul-txt)' };

function Table({ players, me, numbered }) {
  return (
    <table className="sb-table">
      <thead>
        <tr>
          {numbered && <th>#</th>}
          <th>Jugador</th><th style={{ width: 130 }}>Personaje</th>
          <th className="num" style={{ width: 64 }}>Bajas</th><th className="num" style={{ width: 72 }}>Muertes</th>
          <th className="num" style={{ width: 64 }}>Racha</th><th className="num" style={{ width: 56 }}>Ping</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.id} className={`${p.id === me ? 'me' : ''} ${i === 0 ? 'first' : ''}`}>
            {numbered && <td className="pos">{i + 1}</td>}
            <td>{p.n}{p.id === me && <span className="tag-sol you">TÚ</span>}</td>
            <td>{p.c ? <span className="chip-char" style={{ '--c': CHAR_BY_ID[p.c].color }}>{CHAR_BY_ID[p.c].name}</span> : '—'}</td>
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
  const sorted = [...players].sort((a, b) => b.k - a.k || a.d - b.d);
  const teams = mode === 'teams';
  return (
    <div className="scoreboard">
      <div className="sb-head">
        <h2>{info.name}</h2>
        <span>{info.map} · {info.size} · {teams ? `gana el primer equipo en llegar a ${scoreLimit}` : `gana quien llegue a ${scoreLimit} bajas`}</span>
      </div>
      {teams ? (
        [1, 2].map((t) => (
          <div key={t} className="sb-team" style={{ '--t': `var(--eq-${t === 1 ? 'rojo' : 'azul'})`, '--tt': TEAM_TXT[t] }}>
            <div className="sb-team-head">
              <b>Equipo {TEAMS[t].name}</b>
              <span>{teamScore?.[t] ?? 0} / {scoreLimit}</span>
            </div>
            <div className="pbar"><i style={{ width: `${((teamScore?.[t] ?? 0) / scoreLimit) * 100}%` }} /></div>
            <Table players={sorted.filter((p) => p.tm === t)} me={me} />
          </div>
        ))
      ) : (
        <Table players={sorted} me={me} numbered />
      )}
    </div>
  );
}
