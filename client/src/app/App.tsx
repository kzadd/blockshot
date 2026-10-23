import { useState } from 'react';
import type { RoomInfo } from '@blockshot/shared';
import Lobby from '../lobby/Lobby';
import Game from '../game/Game';
import { Curtain, playCurtain, useUiScale } from '../ui/ui';

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
        <Game key={session.room.id} session={session} onLeave={() => playCurtain(() => setSession(null))} />
      ) : (
        <Lobby onJoined={(s) => playCurtain(() => setSession(s))} />
      )}
      <Curtain />
    </>
  );
}
