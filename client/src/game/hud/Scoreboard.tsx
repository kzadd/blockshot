import {
  CHAR_BY_ID,
  WEAPONS,
  gunLadder,
  isTeamMode,
  teamName,
  type ModeId,
  type SideTeam,
  type WeaponId,
} from '@blockshot/shared';
import { Icon } from '../../ui/icons';
import { MODE_UI } from '../modeUi';
import type { RoomView } from '../roomView';
import type { HudPlayer } from './hudState';
import { SIDES, TEAM_TXT, teamVar } from './teamStyle';

/** A streak this long is highlighted with a flame. */
const HOT_STREAK = 3;
const BAD_PING_MS = 120;

// caps = título de la columna de puntos propios (Capturas, Placas…) o nada
interface TableProps {
  players: HudPlayer[];
  me: string;
  numbered?: boolean;
  caps?: string | null;
  ladder?: WeaponId[] | null;
}

function Table({ players, me, numbered, caps, ladder }: TableProps) {
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
          <th className="num" style={{ width: 84 }}>
            Medallas
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
                {Math.min(p.lv + 1, ladder.length)}/{ladder.length} ·{' '}
                {WEAPONS[ladder[Math.min(p.lv, ladder.length - 1)]!].name}
              </td>
            )}
            <td className="num k">{p.k}</td>
            <td className="num">{p.d}</td>
            <td className={`num ${p.st >= HOT_STREAK ? 'fire' : ''}`}>
              {p.st >= HOT_STREAK ? (
                <>
                  <Icon name="flame" size={14} />
                  {p.st}
                </>
              ) : (
                p.st
              )}
            </td>
            <td className="num">{p.md || '—'}</td>
            <td className={`num ping ${p.pg > BAD_PING_MS ? 'bad' : ''}`}>{p.pg || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface ScoreboardProps {
  players: HudPlayer[];
  me: string;
  info: RoomView;
  scoreLimit: number;
  mode: ModeId;
  teamScore: Record<SideTeam, number> | null;
}

export default function Scoreboard({ players, me, info, scoreLimit, mode, teamScore }: ScoreboardProps) {
  const ladder = MODE_UI[mode].top === 'ladder' ? gunLadder(scoreLimit) : null;
  const sorted = [...players].sort((a, b) => (ladder ? b.lv - a.lv : 0) || b.k - a.k || a.d - b.d);
  const teams = isTeamMode(mode);
  const infect = MODE_UI[mode].top === 'infect';
  const caps = MODE_UI[mode].points;
  const goal = MODE_UI[mode].goal(scoreLimit);
  return (
    <div className="scoreboard">
      <div className="sb-head">
        <h2>{info.name}</h2>
        <span>
          {info.map} · {info.size} · {goal}
        </span>
      </div>
      <div className="sb-scroll">
        {teams ? (
          SIDES.map((t) => (
            <div key={t} className="sb-team" style={{ '--t': teamVar(t), '--tt': TEAM_TXT[t] }}>
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
    </div>
  );
}
