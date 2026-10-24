import { CHAR_BY_ID, PLAYER, type CharacterId, type ModeId } from '@blockshot/shared';
import { Feed, RoomInfo, type FeedItem } from '../hud/HUD';
import { useHud } from '../hud/hudStore';
import type { RoomView } from '../roomView';

export interface LastDeath {
  name: string;
  char: CharacterId | null;
  weapon: string;
  hp: number;
}

const MS_PER_S = 1000;

interface Props {
  lastDeath: LastDeath | null;
  current: CharacterId | null;
  feed: FeedItem[];
  you: string;
  mode: ModeId;
  info: RoomView;
  onChangeCharacter: () => void;
}

// Who killed you, the respawn countdown and the button to change character (B)
export default function DeathScreen({ lastDeath, current, feed, you, mode, info, onChangeCharacter }: Props) {
  const h = useHud((s) => ({ sec: Math.ceil(s.respawnIn / MS_PER_S), deathKey: s.deathKey }));
  if (!h) return null;
  const killer = lastDeath?.char ? CHAR_BY_ID[lastDeath.char] : null;
  const me = current ? CHAR_BY_ID[current] : null;
  return (
    <div className="layer stage">
      <div className="death-bg" />
      <div className="death">
        <h2>
          {lastDeath ? (
            <>
              Te eliminó <span className="k">{lastDeath.name}</span>
            </>
          ) : (
            '¡Nueva partida!'
          )}
        </h2>
        {lastDeath && killer && (
          <div className="killer-chip">
            <span className="chip-char" style={{ '--c': killer.color }}>
              {killer.name}
            </span>
            <span>
              {lastDeath.weapon} · {lastDeath.name} tenía <b>{lastDeath.hp}</b> de vida
            </span>
          </div>
        )}
        <div className="countdown">
          <b key={h.sec}>{Math.max(1, h.sec)}</b>
        </div>
        <div className="pbar fill">
          <i key={h.deathKey} style={{ animationDuration: `${PLAYER.respawnDelay}ms` }} />
        </div>
        {me && (
          <div className="as">
            Reapareces como{' '}
            <span className="chip-char" style={{ '--c': me.color }}>
              {me.name}
            </span>
          </div>
        )}
        <button className="btn has-key" onClick={onChangeCharacter}>
          <span className="key">B</span>Cambiar personaje
        </button>
      </div>
      <Feed feed={feed} you={you} mode={mode} />
      <RoomInfo info={info} />
    </div>
  );
}
