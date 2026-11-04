import type { CrosshairConfig } from './settingsStore';

/** Spread (radians) → extra gap in px for the dynamic crosshair, up to a maximum. */
const SPREAD_TO_PX = 350;
const MAX_DYNAMIC_GAP = 36;
/** Dark outline around every piece (px each side): readable on the bright sky and sand walls. */
const OUTLINE_PX = 1;
const OUTLINE = 'rgba(0,0,0,0.7)';

interface Props {
  cfg: CrosshairConfig;
  /** current weapon spread (radians): opens the crosshair when dynamic */
  spread?: number;
  className?: string;
  half?: number;
}

type Rect = [x: number, y: number, w: number, h: number];

// Crosshair drawn in SVG from the settings, like competitive shooters do: square-cut arms and dot on whole
// pixels (crisp at any size), a 1 px dark outline, and the gap opening with the weapon's spread.
export default function Crosshair({ cfg, spread = 0, className = 'crosshair', half = 64 }: Props) {
  const { style, color, size, thickness: t, gap, outline, dynamic } = cfg;
  const g = Math.round(gap + (dynamic ? Math.min(MAX_DYNAMIC_GAP, spread * SPREAD_TO_PX) : 0));
  const o = -t / 2;

  const rects: Rect[] = [];
  if (['cross', 'crossdot', 't', 'x'].includes(style)) {
    if (style !== 't') rects.push([o, -g - size, t, size]);
    rects.push([o, g, t, size], [-g - size, o, size, t], [g, o, size, t]);
  }
  // The dot is a square too: a round one this small only blurs
  const dot = style === 'dot' ? Math.max(2, t + 1) : style === 'crossdot' || style === 'circle' ? t : 0;
  if (dot) rects.push([-dot / 2, -dot / 2, dot, dot]);
  const ringR = style === 'circle' ? g + size * 0.6 : 0;

  const layer = (fill: string, e: number) => (
    <g fill={fill}>
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x - e} y={y - e} width={w + e * 2} height={h + e * 2} />
      ))}
      {ringR > 0 && <circle r={ringR} fill="none" stroke={fill} strokeWidth={t + e * 2} />}
    </g>
  );

  return (
    <svg
      className={className}
      width={half * 2}
      height={half * 2}
      viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}
      shapeRendering={style === 'x' || ringR ? 'geometricPrecision' : 'crispEdges'}
    >
      <g transform={style === 'x' ? 'rotate(45)' : undefined}>
        {outline && layer(OUTLINE, OUTLINE_PX)}
        {layer(color, 0)}
      </g>
    </svg>
  );
}
