import type {
  Collider,
  GameMap,
  ModeId,
  RoomInfo,
  ServerToClientEvents,
  SideTeam,
  VoteOption,
} from '@blockshot/shared';
import type { Deployable } from '../combat/abilities';
import type { Grenade } from '../combat/grenades';
import type { WorldObjects } from '../combat/worldObjects';
import type { Tournament } from '../match/tournament';
import type { GameMode } from '../modes/gameMode';
import type { Player } from '../players/player';

type EventArgs<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>;

/**
 * Outgoing messages of one room. Game logic only talks to this interface, so it does not depend on
 * Socket.IO and can be unit tested with a fake.
 */
export interface RoomChannel {
  /** to everybody in the room, optionally except one player */
  broadcast<E extends keyof ServerToClientEvents>(event: E, args: EventArgs<E>, exceptId?: string): void;
  /** to everybody, dropped if the network is busy (snapshots) */
  broadcastVolatile<E extends keyof ServerToClientEvents>(event: E, args: EventArgs<E>): void;
  /** to a single player */
  to<E extends keyof ServerToClientEvents>(playerId: string, event: E, args: EventArgs<E>): void;
}

export interface Room {
  id: string;
  name: string;
  passHash: string | null;
  hostName: string;
  max: number;
  map: GameMap;
  colliders: Collider[];
  players: Map<string, Player>;
  modeId: ModeId;
  mode: GameMode;
  scoreLimit: number;
  teamScore: Record<SideTeam, number>;
  matchOver: boolean;
  /** someone already scored this match's first kill */
  firstBlood: boolean;
  restartTimer: ReturnType<typeof setTimeout> | null;
  channel: RoomChannel;
  /** end of match vote: options and each player's choice */
  vote: { options: VoteOption[]; choice: Map<string, number> } | null;
  /** tells the lobby the room list changed (map / mode after a vote) */
  lobbyChanged: () => void;
  grenades: Grenade[];
  /** smoke clouds, mines and cover walls (abilities) */
  deployables: Deployable[];
  /** barrels, crates and pickups of the map (worldObjects.ts) */
  world: WorldObjects;
  /** the admin closed the room: nobody new can join */
  closed: boolean;
  /** names the admin kicked: they cannot come back to this room */
  banned: Set<string>;
  /** league tournament in progress (null: normal matches) */
  tournament: Tournament | null;
}

export const roomInfo = (room: Room): RoomInfo => ({
  id: room.id,
  name: room.name,
  scoreLimit: room.scoreLimit,
  mapId: room.map.id,
  size: room.map.size,
  mode: room.modeId,
  max: room.max,
  closed: room.closed,
  tour: room.tournament
    ? { round: room.tournament.round, rounds: room.tournament.rounds, by: room.tournament.by }
    : null,
});

export const notice = (room: Room, text: string): void => room.channel.broadcast('notice', [text]);
