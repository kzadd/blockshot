import { useEffect, useRef } from 'react';
import { getMap } from '@blockshot/shared';

// Vista cenital del mapa dibujada a partir de sus cajas: lo más alto, más claro
export default function MapPreview({ mapId, size, px = 120, className = 'map-preview' }) {
  const ref = useRef(null);

  useEffect(() => {
    const map = getMap(mapId, size);
    const c = ref.current;
    // nitidez: píxeles del dispositivo × escala de la interfaz
    const dpr =
      (window.devicePixelRatio || 1) *
      (Number(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1);
    c.width = c.height = px * dpr;
    const g = c.getContext('2d');
    const s = (px * dpr) / (2 * map.half + 2);
    g.setTransform(s, 0, 0, s, (px * dpr) / 2, (px * dpr) / 2);
    const boxes = [...map.boxes].sort((a, b) => a.y + a.h - (b.y + b.h));
    for (const b of boxes) {
      const top = b.y + b.h;
      g.fillStyle = map.colors[b.c] || map.colors.wall;
      g.filter = b.c === 'floor' ? 'none' : `brightness(${Math.min(1.25, 0.7 + top / 12)})`;
      g.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
    }
    g.filter = 'none';
    g.fillStyle = '#ff4d4d';
    for (const [x, , z] of map.spawns) {
      g.beginPath();
      g.arc(x, z, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }, [mapId, size, px]);

  return <canvas ref={ref} className={className} style={{ width: px, height: px }} />;
}
