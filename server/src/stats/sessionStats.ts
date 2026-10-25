// Statistics since the server started, per player name across every room and match. Only the server's own PC
// can read them (pause menu): they show who plays what, which is how the teacher checks the balance.
import type { CharacterId, SessionStatsRow } from '@blockshot/shared';
import { isBot } from '../players/bot';
import type { Player } from '../players/player';
import type { Room } from '../rooms/room';

type Totals = Omit<SessionStatsRow, 'name'>;

const empty = (): Totals => ({ kills: 0, deaths: 0, shots: 0, hits: 0, heads: 0, medals: 0, picks: {} });
/** Finished matches (and players who left), by name. */
const folded = new Map<string, Totals>();

function add(into: Totals, p: Player): void {
  into.kills += p.kills;
  into.deaths += p.deaths;
  into.shots += p.shots;
  into.hits += p.hits;
  into.heads += p.heads;
  into.medals += p.medals;
  for (const [id, n] of Object.entries(p.picks) as [CharacterId, number][]) into.picks[id] = (into.picks[id] ?? 0) + n;
}

/** Keeps a player's match counters: call it right before they are reset or the player leaves. */
export function foldPlayer(p: Player): void {
  if (isBot(p)) return;
  const t = folded.get(p.name) ?? empty();
  add(t, p);
  folded.set(p.name, t);
}

/** Folded totals plus what is being played right now, best first. */
export function sessionStats(rooms: Iterable<Room>): SessionStatsRow[] {
  const all = new Map<string, Totals>();
  for (const [name, t] of folded) all.set(name, { ...t, picks: { ...t.picks } });
  for (const room of rooms) {
    for (const p of room.players.values()) {
      if (isBot(p)) continue;
      const t = all.get(p.name) ?? empty();
      add(t, p);
      all.set(p.name, t);
    }
  }
  return [...all].map(([name, t]) => ({ name, ...t })).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
}

/** Only for tests. */
export const resetSessionStats = (): void => folded.clear();
