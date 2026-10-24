import type { CharacterId, ModeId, SideTeam, SkinId } from '@blockshot/shared';
import CharacterSelect, { type ColorChoice, type SkinChoice } from '../../characters/CharacterSelect';
import { useHud } from '../hud/hudStore';
import type { RoomView } from '../roomView';

interface Props {
  info: RoomView;
  current: CharacterId | null;
  skins: SkinChoice;
  colors: ColorChoice;
  mode: ModeId;
  onPick: (id: CharacterId, skin: SkinId, color: string) => void;
  onKeep: () => void;
  onLeave: () => void;
  onTeam: (t: SideTeam) => void;
}

// Character select fed with the live game state (respawn countdown, team, players per team)
export default function CharacterScreen({
  info,
  current,
  skins,
  colors,
  mode,
  onPick,
  onKeep,
  onLeave,
  onTeam,
}: Props) {
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
      skins={skins}
      colors={colors}
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
