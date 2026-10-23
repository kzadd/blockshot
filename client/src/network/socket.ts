import { io, type Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import type { ClientToServerEvents, ServerToClientEvents } from '@blockshot/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Connects to the same host that served the page (the teacher's PC in class)
// MessagePack must match the server's parser
export const socket: GameSocket = io({ transports: ['websocket', 'polling'], parser: msgpackParser });
