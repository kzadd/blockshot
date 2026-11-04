import {
  COMBAT_LOCK_MS,
  TEAM_SWITCH_COOLDOWN,
  canSwitchTeam,
  isTeamMode,
  teamName,
  type SideTeam,
} from '@blockshot/shared';
import { notice, type Room } from '../rooms/room';
import { isBot } from './bot';
import type { Player } from './player';
import { spawnPlayer } from './spawn';

export const isTeamRoom = (room: Room): boolean => isTeamMode(room.modeId);
export const sameTeam = (room: Room, a: Player, b: Player): boolean => isTeamRoom(room) && a.team === b.team;

/** Players on each side. */
export function teamCounts(room: Room): Record<SideTeam, number> {
  const n = { 1: 0, 2: 0 };
  for (const p of room.players.values()) if (p.team === 1 || p.team === 2) n[p.team]++;
  return n;
}

/** The team with fewer players (Red on a tie). */
export function smallerTeam(room: Room): SideTeam {
  const n = teamCounts(room);
  return n[1] <= n[2] ? 1 : 2;
}

/** Moving `p` to `team` leaves that team at most one player ahead (so friends cannot stack 4 against 2). */
export function canJoinTeam(room: Room, p: Player, team: SideTeam): boolean {
  const n = teamCounts(room);
  if (p.team === 1 || p.team === 2) n[p.team]--;
  n[team]++;
  return n[team] - n[team === 1 ? 2 : 1] <= 1;
}

/**
 * A player asks to change team. Alive players respawn on their new team's side. Returns why it was refused (a
 * notice for him), or null. During a round (round modes) nobody switches: a dead player would leave his round
 * (or his statue) behind and an alive one would come back with full health on the other side.
 */
export function requestTeam(room: Room, p: Player, team: SideTeam, now: number): string | null {
  if (room.mode.teamsLocked?.(room)) return 'Podrás cambiar de equipo cuando acabe la ronda.';
  // The cooldown stops team hopping mid-game; on the character screen (not alive) you switch at once
  if (p.alive && now - p.teamAt < TEAM_SWITCH_COOLDOWN) return 'Espera unos segundos para volver a cambiar de equipo.';
  if (p.alive && now - p.lastDamage < COMBAT_LOCK_MS) return 'No puedes cambiar de equipo en pleno combate.';
  if (!canJoinTeam(room, p, team)) {
    return `${teamName(room.modeId, team)} ya tiene más jugadores: los equipos se mantienen equilibrados.`;
  }
  p.team = team;
  p.teamAt = now;
  p.streak = 0;
  notice(room, `${p.name} se cambió al equipo ${teamName(room.modeId, team)}`);
  if (p.alive && p.cls) spawnPlayer(room, p);
  return null;
}

/**
 * Teams two or more apart (someone left mid-match): moves one player from the bigger team, never in the middle
 * of a fight (nor during a round of a round mode). A bot first, otherwise someone who is dead (waiting to respawn).
 * Returns who moved.
 */
export function autoBalance(room: Room): Player | null {
  if (room.matchOver || !canSwitchTeam(room.modeId) || room.mode.teamsLocked?.(room)) return null;
  const n = teamCounts(room);
  if (Math.abs(n[1] - n[2]) < 2) return null;
  const big: SideTeam = n[1] > n[2] ? 1 : 2;
  const small: SideTeam = big === 1 ? 2 : 1;
  const pool = [...room.players.values()].filter((p) => p.team === big && !p.alive);
  const p = pool.find(isBot) ?? pool.sort((a, b) => a.kills - b.kills)[0];
  if (!p) return null;
  p.team = small;
  p.teamAt = Date.now();
  p.streak = 0;
  room.channel.to(p.id, 'notice', [`Te hemos pasado a ${teamName(room.modeId, small)} para equilibrar los equipos`]);
  notice(room, `${p.name} pasa a ${teamName(room.modeId, small)} para equilibrar`);
  return p;
}
