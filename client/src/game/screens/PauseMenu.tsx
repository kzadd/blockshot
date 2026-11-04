import { canSwitchTeam, teamName, type ModeId, type SideTeam } from '@blockshot/shared';
import { Icon } from '../../ui/icons';
import { useHud } from '../hud/hudStore';

interface Props {
  mode: ModeId;
  onResume: () => void;
  onSettings: () => void;
  onControls: () => void;
  onSwitchTeam: (team: SideTeam) => void;
  onLeave: () => void;
  /** server PC only: the admin panel (bots, players, room) */
  admin: boolean;
  onAdmin: () => void;
  onRanking: () => void;
  onTour: () => void;
}

export default function PauseMenu({
  mode,
  onResume,
  onSettings,
  onControls,
  onSwitchTeam,
  onLeave,
  admin,
  onAdmin,
  onRanking,
  onTour,
}: Props) {
  const myTeam = useHud((s) => s.myTeam) ?? 0;
  const other: SideTeam = myTeam === 1 ? 2 : 1;
  // A proposal window over the game: clicking outside it goes back to the game
  return (
    <div className="pz pz-layer dim wins" onClick={onResume}>
      <div
        className="win pause-win"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="title" id="pause-title">
          Pausa
        </h1>
        <p className="meta">Los demás siguen jugando</p>
        <button className="btn primary wide" onClick={onResume}>
          Continuar <kbd className="k">Esc</kbd>
        </button>
        <nav className="pw-menu" aria-label="Opciones">
          <button onClick={onSettings}>
            <Icon name="sliders" />
            Ajustes <kbd className="k">O</kbd>
          </button>
          <button onClick={onControls}>
            <Icon name="book" />
            Controles <kbd className="k">H</kbd>
          </button>
          <button onClick={onRanking}>
            <Icon name="award" />
            Ranking
          </button>
          <button onClick={onTour}>
            <Icon name="swords" />
            Torneo
          </button>
          {canSwitchTeam(mode) && myTeam !== 0 && (
            <button onClick={() => onSwitchTeam(other)}>
              <Icon name="users" />
              Pasar a {teamName(mode, other)} <kbd className="k">T</kbd>
            </button>
          )}
          <button className="danger" onClick={onLeave}>
            <Icon name="logout" />
            Salir de la sala
          </button>
        </nav>
        {admin && (
          <div className="pw-admin">
            <span className="lbl">
              <Icon name="lock" />
              Solo en este PC
            </span>
            <button className="btn sm" onClick={onAdmin}>
              Panel de admin <kbd className="k">P</kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
