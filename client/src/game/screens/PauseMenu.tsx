import { canSwitchTeam, teamName, type ModeId, type SideTeam } from '@blockshot/shared';
import { Icon } from '../../ui/icons';
import { socket } from '../../network/socket';
import { Keys } from '../../ui/ui';
import { useHud } from '../hud/hudStore';

const PAUSE_KEYS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Moverse'],
  [['Espacio'], 'Saltar · mantén para encadenar'],
  [['Shift'], 'Esprintar'],
  [['C'], 'Agacharse · deslizarse'],
  [['Clic izq.'], 'Disparar'],
  [['Clic der.'], 'Apuntar'],
  [['R'], 'Recargar'],
  [['1', '2', '3', 'Q'], 'Cambiar de arma (3: cuchillo)'],
  [['Tab'], 'Marcador'],
  [['Esc'], 'Pausa'],
];

interface Props {
  mode: ModeId;
  onResume: () => void;
  onSettings: () => void;
  onManual: () => void;
  onSwitchTeam: (team: SideTeam) => void;
  onLeave: () => void;
  /** server PC only: practice bot tools */
  admin: boolean;
}

export default function PauseMenu({ mode, onResume, onSettings, onManual, onSwitchTeam, onLeave, admin }: Props) {
  const myTeam = useHud((s) => s.myTeam) ?? 0;
  const other: SideTeam = myTeam === 1 ? 2 : 1;
  return (
    <div className="pause-bg" onClick={onResume}>
      <div className="stage">
        <div className="pause-panel">
          <h2>Pausa</h2>
          <p className="sub">
            <b>Haz clic o pulsa Esc para volver</b> · los demás siguen jugando
          </p>
          <div className="key-grid">
            {PAUSE_KEYS.map(([keys, what]) => (
              <div className="key-row" key={what}>
                <Keys keys={keys} />
                <span>{what}</span>
              </div>
            ))}
          </div>
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn has-key" onClick={onSettings}>
              <span className="key">O</span>Ajustes
            </button>
            <button className="btn has-key" onClick={onManual}>
              <span className="key">H</span>Manual
            </button>
            {canSwitchTeam(mode) && myTeam !== 0 && (
              <button className="btn has-key" onClick={() => onSwitchTeam(other)}>
                <span className="key">T</span>Pasar a {teamName(mode, other)}
              </button>
            )}
            <button className="btn ghost danger" onClick={onLeave}>
              <Icon name="logout" />
              Salir de la sala
            </button>
          </div>
          {admin && (
            <div className="admin-row" onClick={(e) => e.stopPropagation()}>
              <span className="kicker">
                <Icon name="lock" />
                Solo en el PC del servidor
              </span>
              <button className="btn sm" onClick={() => socket.emit('bot:add')}>
                <Icon name="plus" />
                Añadir bot que dispara
              </button>
              <button className="btn sm ghost" onClick={() => socket.emit('bot:clear')}>
                <Icon name="x" />
                Quitar bots
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
