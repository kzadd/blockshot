import { Suspense, lazy, useState } from 'react';
import type { RoomInfo } from '@blockshot/shared';
import Lobby from '../lobby/Lobby';
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
  return (
    <>
      {session ? (
        <Suspense fallback={null}>
          <Game key={session.room.id} session={session} onLeave={() => playCurtain(() => setSession(null))} />
        </Suspense>
      ) : (
        <Lobby onJoined={(s) => playCurtain(() => setSession(s))} />
      )}
      <Curtain />
    </>
  );
}
