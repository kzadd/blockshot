// All-time ranking by player name, kept in a JSON file (data/ranking.json by default) so it survives restarts:
// read once when the server starts, written after every finished match. A broken file is set aside, never
// overwritten, and a new season keeps a copy of the old one.
import fs from 'node:fs';
import path from 'node:path';
import { isCharacterId, type CharacterId, type RankingRow, type Team } from '@blockshot/shared';
import type { Logger } from '../logger';
import { isBot } from '../players/bot';
import type { Room } from '../rooms/room';

const FIELDS = ['matches', 'wins', 'kills', 'deaths', 'shots', 'hits', 'heads', 'medals', 'caps'] as const;
/** What the file keeps per name: the counters, spawns per character and the colour last worn with each */
type Totals = Record<(typeof FIELDS)[number], number> & {
  picks: Partial<Record<CharacterId, number>>;
  colors: Partial<Record<CharacterId, string>>;
};
const empty = (): Totals => ({
  matches: 0,
  wins: 0,
  kills: 0,
  deaths: 0,
  shots: 0,
  hits: 0,
  heads: 0,
  medals: 0,
  caps: 0,
  picks: {},
  colors: {},
});

const rows = new Map<string, Totals>();
let file: string | null = null;
let log: Logger | null = null;

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/** Reads the ranking file (a missing file is an empty ranking). From now on every match is saved there. */
export function loadRanking(at: string, logger: Logger): void {
  file = at;
  log = logger;
  rows.clear();
  let text: string;
  try {
    text = fs.readFileSync(at, 'utf8');
  } catch {
    return; // first run: no file yet
  }
  try {
    const data = JSON.parse(text) as { rows?: unknown };
    for (const r of Array.isArray(data.rows) ? data.rows : []) {
      if (typeof r?.name !== 'string') continue;
      const t = empty();
      for (const k of FIELDS) t[k] = Number.isFinite(r[k]) ? Math.max(0, Math.floor(r[k])) : 0;
      // Older files have no picks/colors: those players simply have no favourite yet
      for (const [c, n] of Object.entries(r.picks ?? {}))
        if (isCharacterId(c) && Number.isFinite(n)) t.picks[c] = Math.max(0, Math.floor(n as number));
      for (const [c, col] of Object.entries(r.colors ?? {}))
        if (isCharacterId(c) && typeof col === 'string') t.colors[c] = col;
      rows.set(r.name, t);
    }
    logger.info({ file: at, players: rows.size }, 'ranking loaded');
  } catch (err) {
    // Unreadable: keep it aside for whoever wants to fix it, and start empty instead of losing it on the next save
    const bad = `${at}.bad-${stamp()}`;
    fs.renameSync(at, bad);
    logger.error({ err, file: at, movedTo: bad }, 'ranking file unreadable, starting a new one');
  }
}

function save(): void {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Write then rename: a crash mid-write never leaves half a file
    const tmp = `${file}.tmp`;
    const json = JSON.stringify({ version: 1, rows: [...rows].map(([name, t]) => ({ name, ...t })) }, null, 2);
    fs.writeFileSync(tmp, json);
    try {
      fs.renameSync(tmp, file);
    } catch {
      // Windows / OneDrive can hold the file open (EPERM): write it in place instead
      fs.writeFileSync(file, json);
      fs.rmSync(tmp, { force: true });
    }
  } catch (err) {
    log?.error({ err, file }, 'ranking not saved');
  }
}

/** Adds a finished match: everyone who played (spawned at least once) gets the match, the winners a win. */
export function recordMatch(room: Room, winnerName: string, winnerTeam: Team): void {
  let changed = false;
  for (const p of room.players.values()) {
    if (isBot(p) || Object.keys(p.picks).length === 0) continue;
    const t = rows.get(p.name) ?? empty();
    t.matches++;
    if (winnerTeam ? p.team === winnerTeam : p.name === winnerName) t.wins++;
    t.kills += p.kills;
    t.deaths += p.deaths;
    t.shots += p.shots;
    t.hits += p.hits;
    t.heads += p.heads;
    t.medals += p.medals;
    t.caps += p.caps;
    for (const [c, n] of Object.entries(p.picks) as [CharacterId, number][]) t.picks[c] = (t.picks[c] ?? 0) + n;
    if (p.characterId && p.color) t.colors[p.characterId] = p.color;
    rows.set(p.name, t);
    changed = true;
  }
  if (changed) save();
}

/** Best first: most wins, then most kills, then fewest deaths. */
export function rankingRows(): RankingRow[] {
  return [...rows]
    .map(([name, { picks, colors, ...t }]) => {
      let fav: CharacterId | null = null;
      for (const [c, n] of Object.entries(picks) as [CharacterId, number][]) if (n > (fav ? picks[fav]! : 0)) fav = c;
      return { name, ...t, fav, favColor: (fav && colors[fav]) || '' };
    })
    .sort((a, b) => b.wins - a.wins || b.kills - a.kills || a.deaths - b.deaths);
}

/** New season: the current file is kept as ranking-<date>.json next to it, and the ranking starts empty. */
export function resetRanking(): void {
  if (file && fs.existsSync(file)) {
    const copy = path.join(path.dirname(file), `${path.basename(file, '.json')}-${stamp()}.json`);
    fs.copyFileSync(file, copy);
  }
  rows.clear();
  save();
}
