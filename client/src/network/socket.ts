import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@blockshot/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Connects to the same host that served the page (the teacher's PC in class)
export const socket: GameSocket = io({ transports: ['websocket', 'polling'] });
