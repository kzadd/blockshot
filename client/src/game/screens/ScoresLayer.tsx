import { useEffect, useState } from 'react';
import { MAPS, MODE_BY_ID, type MatchEnd, type ModeId } from '@blockshot/shared';
import { mapImage } from '../../lobby/mapImage';
import { Icon, MODE_ICON } from '../../ui/icons';
import { useHud } from '../hud/hudStore';
import Scoreboard from '../hud/Scoreboard';
import { TEAM_TXT } from '../hud/teamStyle';
import type { RoomView } from '../roomView';

export type MatchState = MatchEnd & { at: number; votes: number[]; myVote: number | null };

const BEST_CARD_STAGGER_MS = 120;
const MS_PER_S = 1000;
const COUNTDOWN_TICK_MS = 250;

interface Props {
  match: MatchState | null;
  you: string;
  info: RoomView;
  scoreLimit: number;
  mode: ModeId;
  onLeave: () => void;
  onVote: (i: number) => void;
}

/** Whole seconds until the next match, refreshed a few times per second. */
function useSecondsLeft(match: MatchState | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!match) return undefined;
    const t = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(t);
  }, [match]);
  return match ? Math.max(0, Math.ceil((match.at + match.restartIn - now) / MS_PER_S)) : 0;
}

// Scoreboard (Tab) and, when the match ends, the winner, your own result and the "best play" cards
export default function ScoresLayer({ match, you, info, scoreLimit, mode, onLeave, onVote }: Props) {
  const h = useHud((s) => ({ players: s.players, teamScore: s.teamScore }));
  const secondsLeft = useSecondsLeft(match);
  if (!h) return null;
  const ranked = [...h.players].sort((a, b) => b.k - a.k || a.d - b.d);
  const pos = ranked.findIndex((p) => p.id === you) + 1;
  const me = ranked[pos - 1];
  return (
    <div className={`scores-layer ${match ? 'end' : ''}`}>
      <div className="stage">
        {match && (
          <div className="end-head">
            <h2 style={{ color: match.team ? TEAM_TXT[match.team] : 'var(--sol)' }}>
              ¡{match.winner} gana la partida!
            </h2>
            {me && (
              <p className="mine">
                Quedaste <b>{pos}º</b> · {me.k} {me.k === 1 ? 'baja' : 'bajas'} · {me.d}{' '}
                {me.d === 1 ? 'muerte' : 'muertes'}
              </p>
            )}
            <div className="sub">
              Nueva partida en {secondsLeft} s
              <div className="pbar fill">
                <i key={match.at} style={{ animationDuration: `${match.restartIn}ms` }} />
              </div>
              <button className="btn ghost sm" onClick={onLeave}>
                Salir de la sala
              </button>
            </div>
            {match.vote.length > 0 && (
              <div className="vote">
                <span className="kicker">Vota la siguiente partida</span>
                <div className="vote-cards">
                  {match.vote.map((o, i) => (
                    <button
                      key={`${o.mapId}-${o.mode}`}
                      className={`vote-card ${match.myVote === i ? 'on' : ''}`}
                      onClick={() => onVote(i)}
                    >
                      <img src={mapImage(o.mapId)} alt="" />
                      <span className="vc-text">
                        <b>{MAPS.find((m) => m.id === o.mapId)?.name}</b>
                        <span>
                          <Icon name={MODE_ICON[o.mode]} size={13} />
                          {MODE_BY_ID[o.mode].name}
                        </span>
                      </span>
                      <span className="vc-count">{match.votes[i] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
