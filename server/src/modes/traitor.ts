// Traidores: everybody looks alike (no teams, friendly fire on) and carries the sidearm and the knife. Each round hidden
// traitors are picked (traitorCount, never a bot while there are people); only they know, each player hears its own
// role alone (`traitor:role`) and the traitors see each other. A traitor's knife kills with one hit. Kills are secret:
// no kill feed, nobody's kills or streak in the snapshot; the body stays where it fell. Key F next to a body examines
// it (privately: whose and what killed it) and, the first time, calls a meeting; away from bodies it calls the one
// emergency meeting a player has each round. A meeting stops everything (nobody moves or hurts, the round clock waits)
// for a vote; the most voted (more than the skips, no tie) is expelled and its role told to everybody. Innocents win
// a round when no traitor is left or the time runs out (traitors must act, and acting leaves clues); traitors win once
// they are as many as the innocents. Winners score (TRAITOR), an innocent who killed an innocent loses a point; first
// to the room's limit wins the match. No respawning during a round (roundPhases), no shrinking zone, no anti-camping.
import { EXPELLED, TRAITOR, round2, traitorCount, type TraitorSnapshot } from '@blockshot/shared';
import { dieAlone } from '../combat/damage';
import { endMatch } from '../match/match';
import { isBot } from '../players/bot';
import type { Player } from '../players/player';
import { notice, type Room } from '../rooms/room';
import type { GameMode } from './gameMode';
import { roundPhases } from './roundPhases';

/** A body examined with key F only within this height difference (m), like a pick-up. */
const BODY_MAX_DY = 2;

interface Body {
  id: string;
  name: string;
  weapon: string;
  x: number;
  y: number;
  z: number;
  at: number;
  reported: boolean;
}

interface Meeting {
  at: number;
  until: number;
  by: string;
  body: string;
  /** voter id → voted id ('' skips) */
  votes: Map<string, string>;
}

export function createTraitor(room: Room): GameMode {
  /** this round's roles: player id → traitor */
  let roles = new Map<string, boolean>();
  let bodies: Body[] = [];
  let meeting: Meeting | null = null;
  /** players who used their emergency meeting this round */
  let called = new Set<string>();
  /** no emergency meeting before this (round start, last meeting) */
  let calmUntil = 0;
  /** innocents killed by each innocent this round (points lost when it ends) */
  let teamKills = new Map<string, number>();

  const isTraitor = (p: Player) => roles.get(p.id) === true;
  const alive = () => [...room.players.values()].filter((p) => p.alive && roles.has(p.id));

  // Only players who picked a class (out of the character screen) count: the others would never spawn
  const ready = () => [...room.players.values()].filter((p) => p.cls).length >= TRAITOR.minPlayers;
  const phases = roundPhases(room, {
    ready,
    timeUp: (now) => endRound(false, now),
    started: (now) => pickTraitors(now),
    roundMs: TRAITOR.roundMs,
  });

  /** A new round: roles picked among those who spawned, each told its own alone. */
  function pickTraitors(now: number): void {
    bodies = [];
    meeting = null;
    called = new Set();
    teamKills = new Map();
    calmUntil = now + TRAITOR.calmMs;
    const playing = [...room.players.values()].filter((p) => p.alive);
    const people = playing.filter((p) => !isBot(p));
    const pool = (people.length ? people : playing).sort(() => Math.random() - 0.5);
    const traitors = new Set(pool.slice(0, traitorCount(playing.length)).map((p) => p.id));
    roles = new Map(playing.map((p) => [p.id, traitors.has(p.id)]));
    for (const p of playing) {
      const traitor = traitors.has(p.id);
      const mates = traitor ? [...traitors].filter((id) => id !== p.id) : [];
      room.channel.to(p.id, 'traitor:role', [{ traitor, mates }]);
      const names = mates.map((id) => room.players.get(id)!.name).join(', ');
      room.channel.to(p.id, 'notice', [
        traitor
          ? `Eres TRAIDOR${names ? ` con ${names}` : ''}: elimina inocentes sin que te descubran (tu cuchillo mata de un golpe)`
          : 'Eres inocente: descubre a los traidores (F junto a un cuerpo para examinarlo)',
      ]);
    }
  }

  /** The round is over: points, the roles told, the break. */
  function endRound(traitorsWin: boolean, now: number): void {
    meeting = null;
    phases.end(now);
    const traitorNames = [...roles].filter(([, t]) => t).map(([id]) => room.players.get(id)?.name ?? '?');
    notice(
      room,
      `Ronda ${phases.round()}: ganan ${traitorsWin ? 'los traidores' : 'los inocentes'} · ` +
        `${traitorNames.length > 1 ? 'Los traidores eran' : 'El traidor era'} ${traitorNames.join(', ')}`,
    );
    for (const [id, traitor] of roles) {
      const p = room.players.get(id);
      if (!p) continue;
      const won = traitor === traitorsWin ? (traitor ? TRAITOR.traitorWin : TRAITOR.innocentWin) : 0;
      p.caps = Math.max(0, p.caps + won - (teamKills.get(id) ?? 0) * TRAITOR.teamKill);
    }
    room.channel.broadcast('flag', [{ type: 'capture' }]); // same cue as a flag capture
    const best = [...room.players.values()].sort((a, b) => b.caps - a.caps)[0];
    if (best && best.caps >= room.scoreLimit) endMatch(room, best.name);
  }

  /** Traitors as many as the innocents still standing win; no traitor left: the innocents. */
  function checkRound(now: number): void {
    if (!phases.playing()) return;
    const left = alive();
    const traitors = left.filter(isTraitor).length;
    if (!traitors) endRound(false, now);
    else if (traitors >= left.length - traitors) endRound(true, now);
  }

  function startMeeting(by: Player, body: string, now: number): void {
    meeting = { at: now, until: now + TRAITOR.meetingMs, by: by.name, body, votes: new Map() };
    // Bots skip
    for (const p of alive()) if (isBot(p)) meeting.votes.set(p.id, '');
    notice(
      room,
      body
        ? `¡${by.name} encontró el cuerpo de ${body}! Reunión: voten a quién expulsar`
        : `¡${by.name} convocó una reunión de emergencia! Voten a quién expulsar`,
    );
  }

  /** The most voted (more than the skips, no tie) is expelled and everybody hears what he was. */
  function endMeeting(m: Meeting, now: number): void {
    meeting = null;
    phases.extend(now - m.at); // the round's clock waited
    calmUntil = now + TRAITOR.calmMs;
    const count = new Map<string, number>();
    for (const [voter, id] of m.votes) {
      if (room.players.get(voter)?.alive && (!id || room.players.get(id)?.alive))
        count.set(id, (count.get(id) ?? 0) + 1);
    }
    const sorted = [...count].sort((a, b) => b[1] - a[1]);
    const tally = sorted.map(([id, n]) => `${id ? room.players.get(id)!.name : 'saltar'} ${n}`).join(', ');
    const [top, second] = sorted;
    const out = top && top[0] && top[1] !== second?.[1] ? room.players.get(top[0]) : undefined;
    if (!out) {
      notice(room, `Nadie es expulsado${tally ? ` (${tally})` : ''}`);
      return;
    }
    notice(room, `${out.name} es expulsado (${tally}): era ${isTraitor(out) ? 'TRAIDOR' : 'inocente'}`);
    dieAlone(room, out, EXPELLED, false); // (onDeath checks the round)
  }

  /** Key F: examine the body at hand (the first time, a meeting), or call the emergency meeting. */
  function action(p: Player, now: number): void {
    if (!phases.playing() || meeting) return;
    const near = (b: Body) =>
      Math.hypot(b.x - p.x, b.z - p.z) <= TRAITOR.bodyRadius && Math.abs(b.y - p.y) <= BODY_MAX_DY;
    const body = bodies.find((b) => now - b.at < TRAITOR.bodyMs && near(b));
    if (body) {
      room.channel.to(p.id, 'notice', [`Cuerpo de ${body.name}: lo mataron con ${body.weapon}`]);
      if (body.reported) return;
      body.reported = true;
      return startMeeting(p, body.name, now);
    }
    if (called.has(p.id)) {
      room.channel.to(p.id, 'notice', ['Ya usaste tu reunión de emergencia en esta ronda']);
      return;
    }
    if (now < calmUntil) {
      room.channel.to(p.id, 'notice', [`Reunión de emergencia disponible en ${Math.ceil((calmUntil - now) / 1000)} s`]);
      return;
    }
    called.add(p.id);
    startMeeting(p, '', now);
  }

  return {
    streakRewards: false,
    powerWeapons: false,
    secretKills: true,
    initialTeam: () => 0,
    canSpawn: () => !phases.playing(),
    paused: () => !phases.playing() || !!meeting,
    // During a meeting nobody moves (the client predicts it with sf) nor hurts; a traitor's knife kills in one hit
    speedFactor: () => (meeting ? 0 : 1),
    damage: (shooter, victim, w, dmg) =>
      meeting ? 0 : isTraitor(shooter) && w.melee ? Math.max(dmg, victim.hp + victim.armor) : dmg,
    action: (_room, p, _o, _d, now) => action(p, now),
    meetingVote(_room, p, id) {
      if (!meeting || !p.alive || !roles.has(p.id) || meeting.votes.has(p.id)) return;
      if (id && !room.players.get(id)?.alive) return;
      meeting.votes.set(p.id, id);
    },
    // Nothing that tells who killed: kills, streak and medals stay hidden until the match ends
    playerSnapshot: () => ({ k: 0, st: 0, md: 0, ...(meeting && { sf: 0 }) }),
    onKill(_room, shooter, victim, w) {
      if (!phases.playing()) return;
      const now = Date.now();
      bodies.push({
        id: victim.id,
        name: victim.name,
        weapon: w.name,
        x: victim.x,
        y: victim.y,
        z: victim.z,
        at: now,
        reported: false,
      });
      // The killer alone learns what the victim was; an innocent's mistake costs him at the end of the round
      if (shooter !== victim && !isTraitor(shooter)) {
        if (isTraitor(victim)) room.channel.to(shooter.id, 'notice', [`¡${victim.name} era traidor!`]);
        else {
          teamKills.set(shooter.id, (teamKills.get(shooter.id) ?? 0) + 1);
          room.channel.to(shooter.id, 'notice', [
            `${victim.name} era inocente: pierdes ${TRAITOR.teamKill} punto al acabar la ronda`,
          ]);
        }
      }
      checkRound(now);
    },
    onDeath: () => checkRound(Date.now()),
    tick(_room, now) {
      if (meeting) {
        const m = meeting;
        const voters = alive();
        if (now >= m.until || voters.every((p) => m.votes.has(p.id))) endMeeting(m, now);
      } else phases.tick(now);
      checkRound(now);
    },
    onMatchReset() {
      phases.reset();
      roles = new Map();
      bodies = [];
      meeting = null;
    },
    snapshot(_room, now) {
      const tt: TraitorSnapshot = {
        bd: bodies
          .filter((b) => now - b.at < TRAITOR.bodyMs && room.players.has(b.id))
          .map((b) => [b.id, round2(b.x), round2(b.y), round2(b.z)]),
        ...(meeting && {
          mt: {
            t: Math.max(0, meeting.until - now),
            by: meeting.by,
            body: meeting.body,
            vd: [...meeting.votes.keys()],
          },
        }),
      };
      return { rd: phases.snapshot(now), tt };
    },
  };
}
