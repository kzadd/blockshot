import type { CharacterId, ModeId, SideTeam } from '@blockshot/shared';
import CharacterSelect from '../../characters/CharacterSelect';
import type { Look } from '../../characters/looks';
import { useHud } from '../hud/hudStore';
import type { RoomView } from '../roomView';

interface Props {
  info: RoomView;
  current: CharacterId | null;
  mode: ModeId;
  onPick: (id: CharacterId, look: Look) => void;
  onKeep: () => void;
  onLeave: () => void;
  onTeam: (t: SideTeam) => void;
}

// Character select fed with the live game state (respawn countdown, team, players per team)
export default function CharacterScreen({ info, current, mode, onPick, onKeep, onLeave, onTeam }: Props) {
  const h = useHud((s) => ({
    everSpawned: s.everSpawned,
    respawnIn: s.respawnIn,
    myTeam: s.myTeam,
    players: s.players,
  }));
  if (!h) return null;
  return (
    <CharacterSelect
      info={info}
      current={current}
      fromDeath={h.everSpawned}
      respawnIn={h.everSpawned ? h.respawnIn : 0}
      onPick={onPick}
      onKeep={h.everSpawned && current ? onKeep : null}
      onLeave={onLeave}
      mode={mode}
      myTeam={h.myTeam}
      players={h.players}
      onTeam={onTeam}
    />
  );
}
