// Parity page: the REAL lobby components with the proposal's demo data (4 rooms, RICARDO), to pixel-diff them
// against .impeccable/mocks/propuesta. Same global CSS as the app (src/main.tsx). No server: the socket is cut.
import { createRoot } from 'react-dom/client';
import { MAPS, MODE_BY_ID, type MapId, type ModeId, type RoomSummary } from '@blockshot/shared';
import '/src/styles/tailwind.css';
import '/src/settings/palette';
import Lobby from '/src/lobby/Lobby';
import { socket } from '/src/network/socket';
import { connectionStore } from '/src/network/connection';
import { useUiScale } from '/src/ui/ui';
import Settings from '/src/settings/SettingsDialog';
import Controls from '/src/manual/Manual';

localStorage.setItem('blockshot:nick', 'RICARDO');
localStorage.removeItem('blockshot:settings');
socket.disconnect();
connectionStore.setState({ status: 'connected' });

const demo = (
  id: string,
  name: string,
  map: MapId,
  mode: ModeId,
  players: number,
  max: number,
  locked = false,
): RoomSummary => ({
  id,
  name,
  players,
  max,
  locked,
  host: 'RICARDO',
  map: MAPS.find((m) => m.id === map)!.name,
  size: 'Mediano',
  mode: MODE_BY_ID[mode].name,
  mapId: map,
  sizeId: 'm',
  modeId: mode,
  limit: MODE_BY_ID[mode].def,
});
const ROOMS = [
  demo('a', 'Sala de Ricardo', 'patio', 'ffa', 5, 12),
  demo('b', 'Clase 3B', 'almacen', 'teams', 10, 10),
  demo('c', 'Torneo viernes', 'desfiladero', 'ffa', 3, 8, true),
  demo('d', 'Recreo', 'ciudad', 'ctf', 4, 12),
];

function Parity() {
  useUiScale();
  // #ingame / #ingame-keys: the in-game Ajustes and Controles windows over a game screenshot
  if (location.hash.startsWith('#ingame'))
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'url(/src/styles/ahora/juego.png) center / cover' }}>
        {location.hash === '#ingame' ? (
          <Settings onClose={() => {}} />
        ) : (
          <div className="pz pz-layer">
            <Controls onClose={() => {}} />
          </div>
        )}
      </div>
    );
  return <Lobby onJoined={() => {}} />;
}
createRoot(document.getElementById('root')!).render(<Parity />);
// Deliver the demo list like the server's 'rooms' event
setTimeout(() => socket.listeners('rooms').forEach((f) => (f as (r: RoomSummary[]) => void)(ROOMS)), 50);
