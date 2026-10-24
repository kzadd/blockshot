import { useEffect, useRef } from 'react';
import { ROOF_KINDS, getMap } from '@blockshot/shared';
import { uiScale } from '../ui/ui';

const SPAWN_DOT_R = 1.1;
const SPAWN_COLOR = '#ff4d4d';
/** Higher boxes look brighter: brightness = base + top height / divisor, capped. */
const BRIGHTNESS_BASE = 0.7;
const BRIGHTNESS_PER_M = 1 / 12;
const BRIGHTNESS_MAX = 1.25;
/** Roofs are drawn see-through so the rooms under them show. */
const ROOF_ALPHA = 0.4;

interface Props {
  mapId: string;
  size: string;
  px?: number;
  className?: string;
}

// Top-down view of a map drawn from its boxes: the higher, the lighter
export default function MapPreview({ mapId, size, px = 120, className = 'map-preview' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const map = getMap(mapId, size);
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    // sharpness: device pixels × UI scale
    const dpr = (window.devicePixelRatio || 1) * uiScale();
    c.width = c.height = px * dpr;
    const s = (px * dpr) / (2 * map.half + 2);
    g.setTransform(s, 0, 0, s, (px * dpr) / 2, (px * dpr) / 2);
    const boxes = [...map.boxes].sort((a, b) => a.y + a.h - (b.y + b.h));
    for (const b of boxes) {
      const top = b.y + b.h;
      g.fillStyle = map.colors[b.c] ?? map.colors.wall;
      g.filter =
        b.c === 'floor' ? 'none' : `brightness(${Math.min(BRIGHTNESS_MAX, BRIGHTNESS_BASE + top * BRIGHTNESS_PER_M)})`;
      g.globalAlpha = ROOF_KINDS.has(b.c) ? ROOF_ALPHA : 1;
      g.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
    }
    g.globalAlpha = 1;
    g.filter = 'none';
    g.fillStyle = SPAWN_COLOR;
    for (const [x, , z] of map.spawns) {
      g.beginPath();
      g.arc(x, z, SPAWN_DOT_R, 0, Math.PI * 2);
      g.fill();
    }
  }, [mapId, size, px]);

  return <canvas ref={ref} className={className} style={{ width: px, height: px }} />;
}
