// Traidores: the meeting's vote, over the game. Everybody sees who called it and who has voted (never for whom);
// the players standing click someone to expel, or skip. The server checks every vote.
import { useEffect, useState } from 'react';
import { socket } from '../../network/socket';
import { Icon } from '../../ui/icons';
import { useHud } from './hudStore';

const MS_PER_S = 1000;

export default function Meeting({ you, onVoted }: { you: string; onVoted: () => void }) {
  const h = useHud((s) => ({ meeting: s.traitor?.meeting ?? null, players: s.players }));
  const [mine, setMine] = useState<string | null>(null);
  const on = !!h?.meeting;
  // A new meeting: a new vote
  useEffect(() => {
    if (!on) setMine(null);
  }, [on]);
  const m = h?.meeting;
  if (!h || !m) return null;
  const standing = h.players.filter((p) => p.a);
  const inIt = standing.some((p) => p.id === you);
  const can = inIt && mine === null && !m.vd.includes(you);
  const cast = (id: string) => {
    socket.emit('traitor:vote', { id });
    setMine(id);
    onVoted();
  };
  return (
    <div className="meeting" role="dialog" aria-labelledby="meetingTitle">
      <div className="meeting-card">
        <span className="kicker">
          {m.body ? `${m.by} encontró el cuerpo de ${m.body}` : `${m.by} convocó una reunión de emergencia`}
        </span>
        <h2 id="meetingTitle">
          ¿A quién expulsan? <b className="meeting-clock">{Math.ceil(m.t / MS_PER_S)} s</b>
        </h2>
        <div className="meeting-list">
          {standing.map((p) => (
            <button
              key={p.id}
              className={`btn${mine === p.id ? ' primary' : ''}`}
              disabled={!can}
              onClick={() => cast(p.id)}
            >
              {p.n}
              {p.id === you && ' (tú)'}
              {m.vd.includes(p.id) && (
                <span className="meeting-voted" title="Ya votó">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
        <button className={`btn${mine === '' ? ' primary' : ''}`} disabled={!can} onClick={() => cast('')}>
          Saltar voto
        </button>
        <small>
          {!inIt
            ? 'Estás fuera: solo puedes mirar'
            : can
              ? 'Hablen y voten: el más votado queda fuera (empate o más saltos: nadie)'
              : 'Voto enviado: esperando al resto'}
        </small>
      </div>
    </div>
  );
}
