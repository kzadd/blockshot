import { STREAK_REWARDS, round2, type Vec3, type Weapon } from '@blockshot/shared';
import type { Player } from '../players/player';
import { notice, type Room } from '../rooms/room';

/** A victim's streak is announced as "ended" from this length. */
const ANNOUNCED_STREAK = 3;

function grantStreakReward(room: Room, shooter: Player, now: number): string | undefined {
  if (!room.mode.streakRewards) return undefined;
  const reward = STREAK_REWARDS[shooter.streak];
  if (!reward) return undefined;
  if (reward.id === 'radar') shooter.radarUntil = now + reward.ms;
  else shooter.armor = reward.amount;
  return reward.name;
}

/** Applies one shot's damage to a victim: armor first, then health; handles the kill. */
export function applyDamage(
  room: Room,
  shooter: Player,
  victim: Player,
  dmg: number,
  head: boolean,
  w: Weapon,
  at3: Vec3,
): void {
  const now = Date.now();
  // Just respawned: invulnerable for a few seconds (until it shoots)
  if (!victim.alive || now < victim.protUntil) return;
  // Armor (streak reward) is spent before health
  const absorbed = Math.min(victim.armor || 0, dmg);
  victim.armor -= absorbed;
  victim.hp -= dmg - absorbed;
  victim.lastDamage = now;
  room.channel.to(victim.id, 'damaged', [
    { hp: Math.max(0, Math.ceil(victim.hp)), from: [round2(shooter.x), round2(shooter.z)] },
  ]);

  const at: Vec3 = [round2(at3[0]), round2(at3[1]), round2(at3[2])];
  if (victim.hp > 0) {
    room.channel.to(shooter.id, 'hitmarker', [{ head, kill: false, dmg: Math.round(dmg), at }]);
    return;
  }
  victim.alive = false;
  victim.hp = 0;
  victim.armor = 0;
  victim.deaths++;
  victim.deathTime = now;
  const ended = victim.streak >= ANNOUNCED_STREAK ? victim.streak : 0;
  victim.streak = 0;
  shooter.kills++;
  shooter.streak++;
  shooter.bestStreak = Math.max(shooter.bestStreak, shooter.streak);
  const reward = grantStreakReward(room, shooter, now);
  room.channel.to(shooter.id, 'hitmarker', [{ head, kill: true, dmg: Math.round(dmg), at }]);
  room.channel.broadcast('kill', [
    {
      killer: shooter.id,
      killerName: shooter.name,
      killerTeam: shooter.team,
      killerChar: shooter.characterId,
      killerHp: Math.ceil(shooter.hp),
      victim: victim.id,
      victimName: victim.name,
      victimTeam: victim.team,
      weapon: w.name,
      head,
      streak: shooter.streak,
      ended,
      reward,
    },
  ]);
  if (reward) notice(room, `${shooter.name} consiguió ${reward} por su racha`);
  room.mode.onKill(room, shooter, victim, w);
}
