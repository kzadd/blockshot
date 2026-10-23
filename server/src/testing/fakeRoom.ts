// Test helpers: real rooms and players, with a recording channel instead of Socket.IO.
import {
  CHAR_BY_ID,
  createMoveState,
  type CharacterId,
  type ModeId,
  type ServerToClientEvents,
} from '@blockshot/shared';
import type { Player } from '../players/player';
import { spawnPlayer } from '../players/spawn';
import { RoomRegistry } from '../rooms/registry';
import type { Room, RoomChannel } from '../rooms/room';

export interface Sent {
  event: keyof ServerToClientEvents;
  args: unknown[];
  /** player id for direct messages, null for broadcasts */
  to: string | null;
}

export class RecordingChannel implements RoomChannel {
  readonly sent: Sent[] = [];
  broadcast: RoomChannel['broadcast'] = (event, args) => void this.sent.push({ event, args, to: null });
  broadcastVolatile: RoomChannel['broadcastVolatile'] = (event, args) => void this.sent.push({ event, args, to: null });
  to: RoomChannel['to'] = (playerId, event, args) => void this.sent.push({ event, args, to: playerId });

  of<E extends keyof ServerToClientEvents>(event: E, to?: string): Parameters<ServerToClientEvents[E]>[0][] {
    return this.sent
      .filter((s) => s.event === event && (to === undefined || s.to === to))
      .map((s) => s.args[0] as Parameters<ServerToClientEvents[E]>[0]);
  }
  notices(): string[] {
    return this.of('notice') as string[];
  }
  clear(): void {
    this.sent.length = 0;
  }
}

export function makeRoom(mode: ModeId, scoreLimit?: number, mapId = 'patio', size = 'm') {
  const channel = new RecordingChannel();
  const registry = new RoomRegistry(() => channel, { changed: () => {} });
  const room = registry.create({ mode, mapId, size, ...(scoreLimit !== undefined ? { scoreLimit } : {}) }, 'Host');
  let n = 0;
  /** Joins a player (team from the mode) and spawns it at (x, z) on the floor, protection off. */
  const join = (name: string, x = 0, z = 0, character: CharacterId = 'soldado'): Player => {
    const id = `p${++n}`;
    registry.addPlayer(room, id, name);
    const p = room.players.get(id)!;
    spawnPlayer(room, p, CHAR_BY_ID[character], 'base');
    place(p, x, z);
    p.protUntil = 0;
    return p;
  };
  const place = (p: Player, x: number, z: number, y = 0) => {
    Object.assign(p, { x, y, z });
    p.move = createMoveState(x, y, z);
    p.hist = [];
  };
  return { room, channel, registry, join, place };
}

export type FakeRoom = ReturnType<typeof makeRoom>;
export type { Room };
