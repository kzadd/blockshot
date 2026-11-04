// Parity page: the real ranking components fed the proposal's 8 demo rows (no server).
import { createRoot } from 'react-dom/client';
import { MAPS, type CharacterId, type RankingRow } from '@blockshot/shared';
import { socket } from '../../../src/network/socket';
import { RankingScreen } from '../../../src/ranking/RankingScreen';
import RankingDialog from '../../../src/ranking/RankingDialog';

// Same as the proposal's RANK: name, wins, matches, kills, deaths, hits, shots, favourite, its colour
const RANK: [string, number, number, number, number, number, number, CharacterId, string][] = [
  ['Lucía', 14, 31, 212, 140, 610, 1450, 'cazador', '#3aa65a'],
  ['Ricardo', 12, 30, 198, 151, 702, 1820, 'soldado', '#3f7fe0'],
  ['Marcos', 9, 28, 176, 160, 540, 1610, 'tanque', '#d0533a'],
  ['Sofía', 8, 26, 150, 149, 480, 1300, 'rayo', '#e8b923'],
  ['Pablo', 6, 25, 131, 170, 455, 1390, 'bastion', '#8a5cd6'],
  ['Ana', 5, 19, 120, 118, 390, 1010, 'explorador', '#26b0a6'],
  ['Dani', 4, 22, 109, 141, 350, 1100, 'artillero', '#e0782e'],
  ['Eva', 3, 17, 88, 102, 300, 870, 'soldado', '#e0609e'],
];
const ROWS: RankingRow[] = RANK.map(([name, wins, matches, kills, deaths, hits, shots, fav, favColor]) => ({
  name,
  wins,
  matches,
  kills,
  deaths,
  hits,
  shots,
  fav,
  favColor,
  heads: 0,
  medals: 0,
  caps: 0,
}));
socket.disconnect();
socket.emit = ((ev: string, cb?: (r: RankingRow[]) => void) => {
  if (ev === 'ranking:get') cb?.(ROWS);
  return socket;
}) as typeof socket.emit;

// The proposal's blurred map backdrop (same code as proto.js blurredMap/setMap, without the fade)
const img = new Image();
img.onload = () => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 36;
  const g = c.getContext('2d')!;
  g.filter = 'blur(2px)';
  g.drawImage(img, -4, -4, 72, 44);
  document.documentElement.style.setProperty('--bgmap', `url(${c.toDataURL('image/jpeg', 0.8)})`);
};
img.src = `/maps/${MAPS[0].id}.jpg`;

if (location.search.includes('window')) {
  document.getElementById('pz')!.remove();
  createRoot(document.getElementById('win')!).render(<RankingDialog admin you="Ricardo" onClose={() => {}} />);
} else {
  createRoot(document.getElementById('mount')!).render(<RankingScreen you="Ricardo" admin />);
}
