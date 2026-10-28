// League tournament: any player can start one (N rounds of free for all, points per place). Only whoever started
// it and the admin can stop it. Shown on its own from the pause menu and inside the admin panel.
import { useEffect, useState } from 'react';
import { TOUR_ROUNDS, type RoomInfo } from '@blockshot/shared';
import { socket } from '../../network/socket';
import { Icon } from '../../ui/icons';

interface PanelProps {
  room: RoomInfo;
  you: string;
  admin: boolean;
  /** after starting it (the dialog closes so the first round can be played) */
  onStart?: () => void;
}

export function TournamentPanel({ room, you, admin, onStart }: PanelProps) {
  const [rounds, setRounds] = useState<number>(TOUR_ROUNDS[1]);
  const tour = room.tour;
  return (
    <section>
      <h2 className="lbl">Torneo</h2>
      {tour ? (
        <>
          <p className="aw-tour">
            Ronda <b>{tour.round}</b> de {tour.rounds}
          </p>
          {admin || tour.by === you ? (
            <button className="btn sm danger" onClick={() => socket.emit('tournament:set', { rounds: 0 })}>
              <Icon name="x" />
              Terminar torneo
            </button>
          ) : (
            <small className="meta">Solo quien lo creó o el admin puede terminarlo</small>
          )}
        </>
      ) : (
        <>
          <div className="seg sm" role="radiogroup" aria-label="Rondas del torneo">
            {TOUR_ROUNDS.map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={rounds === n}
                className={rounds === n ? 'on' : ''}
                onClick={() => setRounds(n)}
              >
                {n} rondas
              </button>
            ))}
          </div>
          <button
            className="btn sm"
            onClick={() => {
              socket.emit('tournament:set', { rounds });
              onStart?.();
            }}
          >
            <Icon name="award" />
            Empezar torneo
          </button>
          <small className="meta">Todos contra todos · cada puesto suma puntos (10, 8, 6…)</small>
        </>
      )}
    </section>
  );
}

export default function TournamentDialog({ onClose, ...p }: Omit<PanelProps, 'onStart'> & { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="pz pz-layer dim wins" onClick={onClose}>
      <div
        className="win tour-win"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="aw-head">
          <div>
            <h1 className="title" id="tour-title">
              Torneo
            </h1>
            <p className="meta">Empezarlo reinicia la partida para todos</p>
          </div>
          <button className="btn sm" onClick={onClose}>
            Cerrar <kbd className="k">Esc</kbd>
          </button>
        </header>
        <TournamentPanel {...p} onStart={onClose} />
      </div>
    </div>
  );
}
