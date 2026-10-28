// Room control for the server's own PC (the teacher): kill or move a player, restart or end the match, or move
// the room to another map and mode right now. Kicking lives in the gateway (it needs the player's socket).
import { CHAR_BY_ID, isTeamMode, teamName, type SideTeam, type Team, type VoteOption } from '@blockshot/shared';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { notice, type Room } from '../rooms/room';
import { endMatch, restartMatch } from './match';
import { applyOption } from './vote';

/** Kills a player without anyone getting the kill (nothing is scored). */
export function adminKill(room: Room, p: Player): void {
  if (!p.alive) return;
  Object.assign(p, { alive: false, hp: 0, armor: 0, streak: 0, deathTime: Date.now() });
  p.inputs.length = 0;
  room.channel.broadcast('kill', [
    {
      killer: p.id,
      killerName: 'Admin',
      killerTeam: 0,
      killerChar: null,
      killerHp: 0,
      victim: p.id,
      victimName: p.name,
      victimTeam: p.team,
      weapon: 'Admin',
      head: false,
      streak: 0,
      ended: 0,
      reward: undefined,
      medals: [],
    },
  ]);
}

/** Team modes: the player goes to the other team (respawning there if alive). The admin skips the balance rule. */
export function adminSwitchTeam(room: Room, p: Player): void {
  if (!isTeamMode(room.modeId) || (p.team !== 1 && p.team !== 2)) return;
  const team: SideTeam = p.team === 1 ? 2 : 1;
  Object.assign(p, { team, teamAt: Date.now(), streak: 0 });
  notice(room, `El admin pasó a ${p.name} a ${teamName(room.modeId, team)}`);
  if (p.alive && p.characterId) spawnPlayer(room, p, CHAR_BY_ID[p.characterId], p.skin, p.color, p.camo, p.finish);
}

/** A fresh match now: scores reset and everybody respawns (with no end of match screen). */
export function adminRestart(room: Room): void {
  if (room.restartTimer) clearTimeout(room.restartTimer);
  room.restartTimer = null;
  room.vote = null;
  room.grenades = [];
  for (const p of room.players.values()) {
    p.alive = false;
    p.inputs.length = 0;
  }
  restartMatch(room);
}

/** Ends the match now: whoever leads wins, with the usual results screen and vote. */
export function adminEnd(room: Room): void {
  if (room.matchOver) return;
  const ps = [...room.players.values()];
  if (isTeamMode(room.modeId)) {
    const team: Team = room.teamScore[1] === room.teamScore[2] ? 0 : room.teamScore[1] > room.teamScore[2] ? 1 : 2;
    endMatch(room, team ? teamName(room.modeId, team) : 'Empate', team);
  } else {
    const best = ps.reduce<Player | null>((a, b) => (!a || b.kills > a.kills ? b : a), null);
    endMatch(room, best?.name ?? '—');
  }
}

/** Moves the room to another map and mode now and starts a fresh match there. */
export function adminChangeRoom(room: Room, opt: VoteOption): void {
  applyOption(room, opt);
  adminRestart(room);
}
