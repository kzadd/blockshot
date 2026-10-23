import type { Collider, GameMap, ModeId, ServerToClientEvents, SideTeam } from '@blockshot/shared';
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
  restartTimer: ReturnType<typeof setTimeout> | null;
  channel: RoomChannel;
}

export const notice = (room: Room, text: string): void => room.channel.broadcast('notice', [text]);
