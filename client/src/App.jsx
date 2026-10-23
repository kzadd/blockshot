import { useState } from 'react';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import { Curtain, playCurtain, useUiScale } from './ui.jsx';

export default function App() {
  const [session, setSession] = useState(null);
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
