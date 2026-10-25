import { useEffect, useRef, type RefObject } from 'react';
import { INDOOR_FLOOR_KINDS, ROOF_KINDS, type GameMap, type SideTeam } from '@blockshot/shared';
import { palette, teamColor } from '../../settings/palette';
import { uiScale } from '../../ui/ui';

/** What the minimap needs from the game, computed by the engine. */
export interface MinimapView {
  me: { x: number; z: number; yaw: number } | null;
  /** players to draw; alpha fades enemies after they shoot */
  dots: { x: number; z: number; mate: boolean; alpha: number }[];
  tags: { x: number; z: number; team: SideTeam }[];
  flags: { x: number; z: number; team: SideTeam }[];
  /** Domination zones: letter in the owner's colour */
  zones: { x: number; z: number; owner: number; letter: string }[];
}
export interface MinimapSource {
  minimap(now: number): MinimapView;
}

const SIZE = 168; // inside of the 180 frame with 6 px padding
const PAD = 6;
const REDRAW_MS = 50;
const BACKGROUND_ALPHA = 0.5;
/** Roofs are see-through so the rooms under them can be read. */
const ROOF_ALPHA = 0.35;
const DOT_R = 5.5;
const INK = '#12171c';

// North-up minimap: you (yellow arrow), allies always in green, enemies in red only after shooting
// (or always, with the streak radar)
export default function Minimap({
  engine,
  map,
  radar,
}: {
  engine: RefObject<MinimapSource | null>;
  map: GameMap;
  radar: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return undefined;
    const k = (window.devicePixelRatio || 1) * uiScale();
    c.width = c.height = SIZE * k;
    const world = (SIZE - PAD * 2) / (2 * map.half + 2); // px per metre
    const toPx = (v: number) => SIZE / 2 + v * world;

    // Background: the map in its colours at 50 %
    const base = document.createElement('canvas');
    base.width = base.height = SIZE * k;
    const b = base.getContext('2d')!;
    b.scale(k, k);
    b.globalAlpha = BACKGROUND_ALPHA;
    for (const box of [...map.boxes].sort((p, q) => p.y + p.h - (q.y + q.h))) {
      if (box.c === 'floor' || INDOOR_FLOOR_KINDS.has(box.c)) continue;
      b.fillStyle = map.colors[box.c] ?? map.colors.wall;
      b.globalAlpha = ROOF_KINDS.has(box.c) ? BACKGROUND_ALPHA * ROOF_ALPHA : BACKGROUND_ALPHA;
      b.fillRect(toPx(box.x - box.w / 2), toPx(box.z - box.d / 2), box.w * world, box.d * world);
    }

    const dot = (x: number, y: number, color: string) => {
      g.beginPath();
      g.arc(x, y, DOT_R, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.stroke();
    };
    const arrow = (w: number, h: number, color: string) => {
      // design clip-path: polygon(50% 0, 100% 100%, 50% 76%, 0 100%)
      g.beginPath();
      g.moveTo(0, -h / 2);
      g.lineTo(w / 2, h / 2);
      g.lineTo(0, h / 2 - h * 0.24);
      g.lineTo(-w / 2, h / 2);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    };

    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const e = engine.current;
      if (!e || now - last < REDRAW_MS) return;
      last = now;
      const view = e.minimap(now);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(base, 0, 0);
      g.setTransform(k, 0, 0, k, 0, 0);

      for (const d of view.dots) {
        g.globalAlpha = d.alpha;
        dot(toPx(d.x), toPx(d.z), d.mate ? palette().ally : palette().enemy);
      }
      g.globalAlpha = 1;

      // Kill confirmed: tags on the floor (diamonds in the victim team colour)
      for (const m of view.tags) {
        const x = toPx(m.x);
        const y = toPx(m.z);
        g.beginPath();
        g.moveTo(x, y - 5);
        g.lineTo(x + 4, y);
        g.lineTo(x, y + 5);
        g.lineTo(x - 4, y);
        g.closePath();
        g.fillStyle = teamColor(m.team, INK);
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = INK;
        g.stroke();
      }

      // Domination: zone letters in their owner's colour
      for (const zn of view.zones) {
        const x = toPx(zn.x);
        const y = toPx(zn.z);
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.fillStyle = zn.owner ? teamColor(zn.owner, INK) : '#ece3cf';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = INK;
        g.stroke();
        g.fillStyle = INK;
        g.font = '700 10px Bungee, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(zn.letter, x, y + 1);
      }

      // Capture the flag: flags always visible (they follow their carrier)
      for (const f of view.flags) {
        const x = toPx(f.x);
        const y = toPx(f.z);
        g.fillStyle = INK;
        g.fillRect(x - 1.5, y - 9, 3, 14);
        g.fillRect(x, y - 10, 11, 9);
        g.fillStyle = teamColor(f.team, INK);
        g.fillRect(x + 1.5, y - 8.5, 8, 6);
      }

      if (view.me) {
        g.save();
        g.translate(toPx(view.me.x), toPx(view.me.z));
        g.rotate(-view.me.yaw);
        arrow(22, 24, INK);
        arrow(14, 16, '#ffc531');
        g.restore();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [engine, map]);

  return (
    <div className="minimap">
      <canvas ref={ref} />
      {radar && <span className="radar-on">RADAR</span>}
      <span className="north">N</span>
    </div>
  );
}
