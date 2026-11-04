// All-time ranking by player name, kept in a JSON file (data/ranking.json by default) so it survives restarts:
// read once when the server starts, written after every finished match. A broken file is set aside, never
// overwritten, and a new season keeps a copy of the old one.
import fs from 'node:fs';
import path from 'node:path';
import { isOutfitColor, isWeaponId, type RankingRow, type Team, type WeaponId } from '@blockshot/shared';
import type { Logger } from '../logger';
import { isBot } from '../players/bot';
import type { Room } from '../rooms/room';

const FIELDS = ['matches', 'wins', 'kills', 'deaths', 'shots', 'hits', 'heads', 'medals', 'caps'] as const;
/** What the file keeps per name: the counters, spawns per primary weapon and the outfit colour last worn */
type Totals = Record<(typeof FIELDS)[number], number> & {
  picks: Partial<Record<WeaponId, number>>;
  color: string;
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
  color: '',
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
      // Older files counted characters (gone, 2026-11-04) instead of weapons: those players start a new favourite
      for (const [w, n] of Object.entries(r.picks ?? {}))
        if (isWeaponId(w) && Number.isFinite(n)) t.picks[w] = Math.max(0, Math.floor(n as number));
      if (isOutfitColor(r.color)) t.color = r.color;
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
    if (isBot(p) || !p.played) continue;
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
    for (const [w, n] of Object.entries(p.picks) as [WeaponId, number][]) t.picks[w] = (t.picks[w] ?? 0) + n;
    if (p.color) t.color = p.color;
    rows.set(p.name, t);
    changed = true;
  }
  if (changed) save();
}

/** Best first: most wins, then most kills, then fewest deaths. */
export function rankingRows(): RankingRow[] {
  return [...rows]
    .map(([name, { picks, color, ...t }]) => {
      let fav: WeaponId | null = null;
      for (const [w, n] of Object.entries(picks) as [WeaponId, number][]) if (n > (fav ? picks[fav]! : 0)) fav = w;
      return { name, ...t, fav, favColor: color };
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
