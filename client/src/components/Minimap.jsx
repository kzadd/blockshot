import { useEffect, useRef } from 'react';
import { palette, teamColor } from '../palette.js';

const SIZE = 164; // interior del recuadro de 170 con borde de 3
const PAD = 6;
const SHOW_SHOT_MS = 1500; // un enemigo aparece después de disparar y se desvanece en 1,5 s

// Minimapa con el norte arriba: tú (flecha amarilla), aliados en verde siempre y enemigos en rojo solo cuando disparan
// (o siempre, con el radar de la racha)
export default function Minimap({ engine, map, radar }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    const k =
      (window.devicePixelRatio || 1) *
      (Number(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1);
    c.width = c.height = SIZE * k;
    const g = c.getContext('2d');
    const world = (SIZE - PAD * 2) / (2 * map.half + 2); // px por metro
    const toPx = (v) => SIZE / 2 + v * world;

    // Fondo: el mapa con sus colores al 50 %
    const base = document.createElement('canvas');
    base.width = base.height = SIZE * k;
    const b = base.getContext('2d');
    b.scale(k, k);
    b.globalAlpha = 0.5;
    for (const box of [...map.boxes].sort((p, q) => p.y + p.h - (q.y + q.h))) {
      if (box.c === 'floor') continue;
      b.fillStyle = map.colors[box.c] || map.colors.wall;
      b.fillRect(toPx(box.x - box.w / 2), toPx(box.z - box.d / 2), box.w * world, box.d * world);
    }

    const dot = (x, y, color) => {
      g.beginPath();
      g.arc(x, y, 5.5, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#0b1426';
      g.stroke();
    };
    const arrow = (w, h, color) => {
      // clip-path del diseño: polygon(50% 0, 100% 100%, 50% 76%, 0 100%)
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
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const e = engine.current;
      if (!e || now - last < 50) return;
      last = now;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(base, 0, 0);
      g.setTransform(k, 0, 0, k, 0, 0);

      for (const r of e.remotes.values()) {
        if (!r.alive || !r.model) continue;
        const p = r.model.group.position;
        const mate = e.isMate(r);
        const age = e.radar ? 0 : now - (r.lastShot || -1e9);
        if (!mate && age > SHOW_SHOT_MS) continue;
        g.globalAlpha = mate ? 1 : 1 - age / SHOW_SHOT_MS;
        dot(toPx(p.x), toPx(p.z), mate ? palette().ally : palette().enemy);
      }
      g.globalAlpha = 1;

      // Confirmar bajas: placas en el suelo (rombos del color del equipo de la víctima)
      for (const m of e.tags.values()) {
        const x = toPx(m.position.x);
        const y = toPx(m.position.z);
        g.beginPath();
        g.moveTo(x, y - 5);
        g.lineTo(x + 4, y);
        g.lineTo(x, y + 5);
        g.lineTo(x - 4, y);
        g.closePath();
        g.fillStyle = teamColor(m.userData.team);
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = '#0b1426';
        g.stroke();
      }

      // Captura la bandera: banderas siempre visibles (siguen a quien las lleva)
      for (const t of e.flags ? [1, 2] : []) {
        const f = e.flags[t];
        const p = f.c === e.myId ? e.pos : (e.remotes.get(f.c)?.model?.group.position ?? f);
        const x = toPx(p.x);
        const y = toPx(p.z);
        g.fillStyle = '#0b1426';
        g.fillRect(x - 1.5, y - 9, 3, 14);
        g.fillRect(x, y - 10, 11, 9);
        g.fillStyle = teamColor(t);
        g.fillRect(x + 1.5, y - 8.5, 8, 6);
      }

      if (e.alive) {
        g.save();
        g.translate(toPx(e.pos.x), toPx(e.pos.z));
        g.rotate(-e.yaw);
        arrow(22, 24, '#1b2a4a');
        arrow(14, 16, '#ffc93c');
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
