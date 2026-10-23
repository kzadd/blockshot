import type { MatchEnd, ModeId } from '@blockshot/shared';
import { useHud } from '../hud/hudStore';
import Scoreboard from '../hud/Scoreboard';
import { TEAM_TXT } from '../hud/teamStyle';
import type { RoomView } from '../roomView';

export type MatchState = MatchEnd & { at: number };

const BEST_CARD_STAGGER_MS = 120;

interface Props {
  match: MatchState | null;
  you: string;
  info: RoomView;
  scoreLimit: number;
  mode: ModeId;
}

// Scoreboard (Tab) and, when the match ends, the winner and the "best play" cards
export default function ScoresLayer({ match, you, info, scoreLimit, mode }: Props) {
  const h = useHud((s) => ({ players: s.players, teamScore: s.teamScore }));
  if (!h) return null;
  return (
    <div className={`scores-layer ${match ? 'end' : ''}`}>
      <div className="stage">
        {match && (
          <div className="end-head">
            <h2 style={{ color: match.team ? TEAM_TXT[match.team] : 'var(--sol)' }}>
              ¡{match.winner} gana la partida!
            </h2>
            <div className="sub">
              Nueva partida en unos segundos…
              <div className="pbar fill">
                <i key={match.at} style={{ animationDuration: `${match.restartIn}ms` }} />
              </div>
            </div>
            {match.best.length > 0 && (
              <div className="best">
                {match.best.map((b, i) => (
                  <div key={b.t} className="best-card" style={{ animationDelay: `${i * BEST_CARD_STAGGER_MS}ms` }}>
                    <span className="kicker">Mejor jugada</span>
                    <span className="t">{b.t}</span>
                    <span className="v">{b.v}</span>
                    <span className="n">{b.n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <Scoreboard
          players={h.players}
          me={you}
          info={info}
          scoreLimit={scoreLimit}
          mode={mode}
          teamScore={h.teamScore}
        />
      </div>
    </div>
  );
}
