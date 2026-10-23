// Connection state in one place: connecting, connected, reconnecting (with attempts) and whether a game was
// lost because of it. Socket.IO reconnects by itself except when the server closed the connection, which is
// handled here explicitly.
import { create } from 'zustand';
import { socket } from './socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  /** reconnection attempts since the connection was lost */
  attempts: number;
  /** the player was in a room when the connection dropped (the lobby explains it once) */
  lostGame: boolean;
}

export const connectionStore = create<ConnectionState>(() => ({
  status: socket.connected ? 'connected' : 'connecting',
  attempts: 0,
  lostGame: false,
}));

socket.on('connect', () => connectionStore.setState({ status: 'connected', attempts: 0 }));
socket.on('disconnect', (reason) => {
  connectionStore.setState({ status: 'reconnecting' });
  // The server closed it on purpose (e.g. a restart): Socket.IO does not retry this case by itself
  if (reason === 'io server disconnect') socket.connect();
});
socket.io.on('reconnect_attempt', (n) => connectionStore.setState({ status: 'reconnecting', attempts: n }));

export const useConnection = <T>(select: (s: ConnectionState) => T): T => connectionStore(select);

/** Called by the game screen when the connection dropped mid-game. */
export const markGameLost = (): void => connectionStore.setState({ lostGame: true });
export const clearGameLost = (): void => connectionStore.setState({ lostGame: false });
