import { ABILITIES, PLAYER, classLabel, isTeamMode, type ModeId, type PlayerClass } from '@blockshot/shared';
import { Icon } from '../../ui/icons';
import { Feed, RoomInfo, type FeedItem } from '../hud/HUD';
import { useHud } from '../hud/hudStore';
import type { SpectateView } from '../hud/hudState';
import { TEAM_TXT } from '../hud/teamStyle';
import type { RoomView } from '../roomView';

export interface LastDeath {
  name: string;
  /** the killer's class */
  cls: PlayerClass | null;
  weapon: string;
  hp: number;
}

const MS_PER_S = 1000;

interface Props {
  lastDeath: LastDeath | null;
  /** the class you respawn with */
  current: PlayerClass | null;
  feed: FeedItem[];
  you: string;
  mode: ModeId;
  info: RoomView;
  onChangeCharacter: () => void;
}

// Who killed you, the respawn countdown and the button to change class or team (B)
export default function DeathScreen({ lastDeath, current, feed, you, mode, info, onChangeCharacter }: Props) {
  const h = useHud((s) => ({
    sec: Math.ceil(s.respawnIn / MS_PER_S),
    deathKey: s.deathKey,
    round: s.round,
    replay: s.replay,
    spectate: s.spectate,
  }));
  if (!h) return null;
  const killer = lastDeath?.cls ?? null;
  const me = current;
  // Round modes: dead until the round is over (Congelados: until a teammate thaws you)
  const waiting = h.round?.p === 1;
  const frozen = waiting && mode === 'freeze';
  // Spectating a living player (after the replay): only a compact bar, the view stays clear
  if (h.spectate && !h.replay) {
    return (
      <div className="layer stage">
        <SpectateBar
          view={h.spectate}
          teams={isTeamMode(mode)}
          wait={frozen ? 'Congelado · un compañero a tu lado te descongela' : `Vuelves en la ronda ${h.round!.n + 1}`}
          onChangeCharacter={onChangeCharacter}
        />
        <Feed feed={feed} you={you} mode={mode} />
      </div>
    );
  }
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
            <span className="chip-char">{ABILITIES[killer.ability].name}</span>
            <span>
              {lastDeath.weapon} · {lastDeath.name} tenía <b>{lastDeath.hp}</b> de vida
            </span>
          </div>
        )}
        {waiting ? (
          <p className="round-wait">
            {frozen
              ? 'Estás congelado · espera a que un compañero se quede a tu lado para descongelarte'
              : `Sin reaparecer en esta ronda · vuelves en la ronda ${h.round!.n + 1}`}
          </p>
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
            Reapareces con <span className="chip-char">{classLabel(me)}</span>
          </div>
        )}
        <button className="btn has-key" onClick={onChangeCharacter}>
          <span className="key">B</span>Cambiar clase o equipo
        </button>
      </div>
      <Feed feed={feed} you={you} mode={mode} />
      <RoomInfo info={info} />
    </div>
  );
}

/** Whom the camera follows while dead for the rest of the round, their health and weapon, and how to switch. */
function SpectateBar({
  view,
  teams,
  wait,
  onChangeCharacter,
}: {
  view: SpectateView;
  teams: boolean;
  wait: string;
  onChangeCharacter: () => void;
}) {
  const t = view.target;
  const color = t?.team ? TEAM_TXT[t.team] : 'var(--txt-1)';
  const ability = t?.ability ? ABILITIES[t.ability] : null;
  return (
    <div className="spec-bar" style={{ '--spec-c': color }}>
      <div className="spec-who">
        {t ? (
          <>
            <span className="spec-label">Observando a</span>
            <b style={{ color }}>{t.name}</b>
            {ability && <span className="chip-char">{ability.name}</span>}
          </>
        ) : (
          <span className="spec-label">
            {teams ? 'Nadie de tu equipo sigue en pie' : 'No queda nadie en pie'} · vista del mapa
          </span>
        )}
      </div>
      {t && (
        <div className="spec-stats">
          <span className="spec-hp" aria-label={`Vida ${t.hp} de ${t.maxHp}`}>
            <i style={{ width: `${Math.min(100, (t.hp / t.maxHp) * 100)}%` }} />
          </span>
          <b className="spec-hp-num">{t.hp}</b>
          {t.weapon && <span className="spec-weapon">{t.weapon}</span>}
        </div>
      )}
      <div className="spec-foot">
        <span>{wait}</span>
        {t && (
          <span className="spec-keys">
            <span className="key">←</span>
            <span className="key">→</span> o clic para cambiar
          </span>
        )}
        <button className="btn sm has-key" onClick={onChangeCharacter}>
          <span className="key">B</span>Clase
        </button>
      </div>
    </div>
  );
}
