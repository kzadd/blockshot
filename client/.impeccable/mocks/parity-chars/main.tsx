// Parity page: the REAL character screen (src/characters/CharacterSelect) in the proposal's state (Soldado,
// Patio behind, base skin, free for all), to pixel-diff against propuesta/index.html#personaje.
import { createRoot } from 'react-dom/client';
import { MAPS } from '@blockshot/shared';
import CharacterSelect from '/src/characters/CharacterSelect';
import '/src/styles/tailwind.css';

const info = { name: 'Sala de Ricardo', map: MAPS[0]!.name, size: 'Mediano', players: 5, max: 12 };
createRoot(document.getElementById('root')!).render(
  <CharacterSelect info={info} mode="ffa" current={null} onPick={() => {}} onLeave={() => {}} />,
);
