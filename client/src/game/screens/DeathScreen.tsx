import { CHAR_BY_ID, PLAYER, type CharacterId, type ModeId } from '@blockshot/shared';
import { Icon } from '../../ui/icons';
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
  const h = useHud((s) => ({
    sec: Math.ceil(s.respawnIn / MS_PER_S),
    deathKey: s.deathKey,
    round: s.round,
    replay: s.replay,
  }));
  if (!h) return null;
  const killer = lastDeath?.char ? CHAR_BY_ID[lastDeath.char] : null;
  const me = current ? CHAR_BY_ID[current] : null;
  // Rounds: dead until the round is over
  const waiting = mode === 'rounds' && h.round?.p === 1;
  return (
    <div className="layer stage">
      <div className="death-bg" />
      {h.replay && lastDeath && (
        <div className="replay-tag">
          <Icon name="video" size={14} />
          Repetición · así te vio <b>{lastDeath.name}</b>
        </div>
      )}
      {/* During the replay the card steps aside to the bottom-left corner: the killer's view stays clear */}
      <div className={`death ${h.replay ? 'replaying' : ''}`}>
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
        {waiting ? (
          <p className="round-wait">Sin reaparecer en esta ronda · vuelves en la ronda {h.round!.n + 1}</p>
        ) : (
          <>
            <div className="countdown">
              <b key={h.sec}>{Math.max(1, h.sec)}</b>
            </div>
            <div className="pbar fill">
              <i key={h.deathKey} style={{ animationDuration: `${PLAYER.respawnDelay}ms` }} />
            </div>
          </>
        )}
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
