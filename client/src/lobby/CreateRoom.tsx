import type { FormEvent, ReactNode } from 'react';
import {
  MAPS,
  MAP_SIZES,
  MODE_BY_ID,
  RACE_MAP,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  type MapId,
  type ModeId,
  type SizeId,
} from '@blockshot/shared';
import { mapImage } from './mapImage';
import { MODE_GROUPS, MODE_HOW, MODE_ICON, MODE_SUB } from './modeCopy';

// «Crear sala» in one screen, no scrolling: the choices on the left in the order they depend on each other
// (map → mode → rules), the room as it will be on the right with the button that creates it.

export interface RoomForm {
  name: string;
  password: string;
  mapId: MapId;
  size: SizeId;
  mode: ModeId;
  scoreLimit: number;
  max: number;
}

/** More players than this × the size's recommendation gets a warning. */
const CROWDED_FACTOR = 1.5;

export const ModeIcon = ({ id }: { id: ModeId }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MODE_ICON[id] }} />
);
export const Lock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z" />
  </svg>
);

function Step({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  const id = `mk-step-${n}`;
  return (
    <section className="mk-step" aria-labelledby={id}>
      <h2 className="mk-h" id={id}>
        <i aria-hidden="true">{n}</i>
        {title}
        {aside && <span className="mk-aside">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

interface CreateRoomProps {
  form: RoomForm;
  setForm: (f: RoomForm) => void;
  hidden: boolean;
  connected: boolean;
  nickname: string;
  onSubmit: (e: FormEvent) => void;
}

export default function CreateRoom({ form, setForm, hidden, connected, nickname, onSubmit }: CreateRoomProps) {
  const map = MAPS.find((m) => m.id === form.mapId) ?? MAPS[0]!;
  const mode = MODE_BY_ID[form.mode];
  const size = MAP_SIZES[form.size];
  const crowded = form.max > size.players * CROWDED_FACTOR;
  const placeholder = `SALA DE ${(nickname || 'tu clase').toUpperCase()}`;

  const pickMap = (id: MapId) => {
    // Circuito only hosts Carrera (and back to a normal mode when leaving it)
    const next = id === RACE_MAP ? 'race' : form.mode === 'race' ? 'ffa' : form.mode;
    setForm({
      ...form,
      mapId: id,
      mode: next,
      scoreLimit: next === form.mode ? form.scoreLimit : MODE_BY_ID[next].def,
    });
  };
  const pickMode = (id: ModeId) => {
    const mapId = id === 'race' ? RACE_MAP : form.mapId === RACE_MAP ? MAPS[0]!.id : form.mapId;
    setForm({ ...form, mode: id, mapId, scoreLimit: MODE_BY_ID[id].def });
  };

  const summary: [string, ReactNode][] = [
    ['Sala', (form.name.trim() || placeholder).toUpperCase()],
    ['Para ganar', `${form.scoreLimit} ${mode.unit}`],
    ['Jugadores', crowded ? `Hasta ${form.max} · recomendado ${size.players}` : `Hasta ${form.max}`],
    [
      'Acceso',
      form.password.trim() ? (
        <>
          <Lock /> Con contraseña
        </>
      ) : (
        'Libre'
      ),
    ],
  ];

  return (
    <form className="lt mk" hidden={hidden} onSubmit={onSubmit}>
      <div className="mk-steps">
        <Step n={1} title="Mapa">
          <div className="mk-maps" role="group" aria-label="Mapa">
            {MAPS.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`mk-map ${form.mapId === m.id ? 'on' : ''}`}
                aria-pressed={form.mapId === m.id}
                title={m.desc}
                onClick={() => pickMap(m.id)}
              >
                <img src={mapImage(m.id)} alt="" />
                <span>{m.name}</span>
                {m.id === RACE_MAP && <em>Solo Carrera</em>}
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Modo">
          <div className="mk-modes">
            {MODE_GROUPS.map((g) => (
              <div className="mk-group" role="group" aria-label={g.name} key={g.name}>
                <h3 className="lbl">{g.name}</h3>
                {g.modes.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className={`mk-mode ${form.mode === id ? 'on' : ''}`}
                    aria-pressed={form.mode === id}
                    title={MODE_SUB[id]}
                    onClick={() => pickMode(id)}
                  >
                    <ModeIcon id={id} />
                    {MODE_BY_ID[id].name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Step>

        <Step n={3} title="Reglas">
          <div className="mk-rules">
            <div>
              <span className="lbl" id="mk-limit">
                Para ganar
              </span>
              <div className="seg" role="group" aria-labelledby="mk-limit">
                {mode.limits.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={form.scoreLimit === n ? 'on' : ''}
                    aria-pressed={form.scoreLimit === n}
                    onClick={() => setForm({ ...form, scoreLimit: n })}
                  >
                    {n} {mode.unit}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="lbl" id="mk-max">
                Jugadores
              </span>
              <div className="mk-max">
                <div className="stepper" role="group" aria-labelledby="mk-max">
                  <button
                    type="button"
                    aria-label="Menos jugadores"
                    disabled={form.max <= ROOM_MIN_PLAYERS}
                    onClick={() => setForm({ ...form, max: form.max - 1 })}
                  >
                    −
                  </button>
                  <b aria-live="polite">{form.max}</b>
                  <button
                    type="button"
                    aria-label="Más jugadores"
                    disabled={form.max >= ROOM_MAX_PLAYERS}
                    onClick={() => setForm({ ...form, max: form.max + 1 })}
                  >
                    +
                  </button>
                </div>
                <small className={crowded ? 'warn' : 'meta'}>
                  {crowded ? `Muchos para este mapa: mejor ${size.players}` : `Recomendado: ${size.players}`}
                </small>
              </div>
            </div>
          </div>
        </Step>
      </div>

      <aside className="mk-side" aria-label="Tu sala">
        <div className="mk-card">
          <div className="mk-shot">
            <img src={mapImage(map.id)} alt="" />
            <b>{map.name}</b>
            <small>{map.tag}</small>
          </div>
          <p className="mk-desc">{map.desc}</p>
          <div className="mk-mode-info" key={mode.id}>
            <span className="mk-chip">
              <ModeIcon id={mode.id} />
              {mode.name}
            </span>
            <strong>{MODE_SUB[mode.id]}</strong>
            <p>{MODE_HOW[mode.id]}</p>
          </div>
        </div>
        <div className="two">
          <label>
            <span className="lbl">Nombre de la sala</span>
            <input
              className="upper"
              value={form.name}
              maxLength={24}
              placeholder={placeholder}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span className="lbl">Contraseña · opcional</span>
            <input
              value={form.password}
              maxLength={32}
              placeholder="Vacía: entra cualquiera"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        </div>
        <dl className="summary">
          {summary.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn primary wide" disabled={!connected}>
          Crear y entrar
        </button>
      </aside>
    </form>
  );
}
