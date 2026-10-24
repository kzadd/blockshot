import { MATCH_RESTART_MS, type BestPlay, type Team } from '@blockshot/shared';
import { resetMatchStats, type Player } from '../players/player';
import type { Room } from '../rooms/room';

/** Accuracy only counts for players who fired at least this many shots. */
const MIN_SHOTS_FOR_ACCURACY = 10;

/** Three "best play" cards: longest streak, most headshots and best accuracy. */
export function bestPlays(room: Room): BestPlay[] {
  const ps = [...room.players.values()];
  const first = ps[0];
  if (!first) return [];
  const top = (f: (p: Player) => number) => ps.reduce((a, b) => (f(b) > f(a) ? b : a), first);
  const out: BestPlay[] = [];
  const st = top((p) => p.bestStreak);
  if (st.bestStreak > 0) out.push({ t: 'Más bajas seguidas', v: String(st.bestStreak), n: st.name });
  const hd = top((p) => p.heads);
  if (hd.heads > 0) out.push({ t: 'Tiros a la cabeza', v: String(hd.heads), n: hd.name });
  const shooters = ps.filter((p) => p.shots >= MIN_SHOTS_FOR_ACCURACY);
  if (shooters.length) {
    const ac = shooters.reduce((a, b) => (b.hits / b.shots > a.hits / a.shots ? b : a));
    out.push({
      t: 'Precisión',
      v: `${Math.round((ac.hits / ac.shots) * 100)} %`,
      n: `${ac.name} · ${ac.hits} de ${ac.shots}`,
    });
  }
  return out;
}

/** Ends the match, shows the results and starts a new one after MATCH_RESTART_MS. */
export function endMatch(room: Room, winnerName: string, winnerTeam: Team = 0): void {
  room.matchOver = true;
  for (const p of room.players.values()) p.alive = false;
  const scores = [...room.players.values()]
    .map((p) => ({ name: p.name, kills: p.kills, deaths: p.deaths, team: p.team }))
    .sort((a, b) => b.kills - a.kills);
  room.channel.broadcast('match:end', [
    { winner: winnerName, team: winnerTeam, scores, best: bestPlays(room), restartIn: MATCH_RESTART_MS },
  ]);
  room.restartTimer = setTimeout(() => restartMatch(room), MATCH_RESTART_MS);
}

export function restartMatch(room: Room): void {
  room.teamScore = { 1: 0, 2: 0 };
  room.mode.onMatchReset?.(room);
  for (const p of room.players.values()) resetMatchStats(p);
  room.matchOver = false;
  room.channel.broadcast('match:start', []);
}
