import { Suspense, lazy, useState } from 'react';
import type { RoomInfo } from '@blockshot/shared';
import Lobby from '../lobby/Lobby';
import GameErrorBoundary from './GameErrorBoundary';
import { Curtain, playCurtain, useUiScale } from '../ui/ui';

// The game (three.js and the engine) only loads when entering a room: the lobby opens faster
const Game = lazy(() => import('../game/Game'));

export interface Session {
  you: string;
  room: RoomInfo;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  useUiScale();
  const leave = () => playCurtain(() => setSession(null));
  return (
    <>
      {session ? (
        <GameErrorBoundary key={session.room.id} onLeave={leave}>
          <Suspense fallback={null}>
            <Game session={session} onLeave={leave} />
          </Suspense>
        </GameErrorBoundary>
      ) : (
        <Lobby onJoined={(s) => playCurtain(() => setSession(s))} />
      )}
      <Curtain />
    </>
  );
}
