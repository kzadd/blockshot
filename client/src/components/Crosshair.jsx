// Mira dibujada en SVG a partir de los ajustes. `spread` (radianes) la abre si es dinámica.
export default function Crosshair({ cfg, spread = 0, className = 'crosshair', half = 64 }) {
  const { style, color, size, thickness: t, gap, outline, dynamic } = cfg;
  const g = gap + (dynamic ? Math.min(36, spread * 350) : 0);

  const arms =
    style === 't'
      ? [
          [0, 1],
          [-1, 0],
          [1, 0],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ];
  const lines = ['cross', 'crossdot', 't', 'x'].includes(style)
    ? arms.map(([dx, dy]) => [dx * g, dy * g, dx * (g + size), dy * (g + size)])
    : [];
  const dotR =
    style === 'dot' ? Math.max(1.5, t * 1.25) : style === 'crossdot' || style === 'circle' ? t * 0.6 + 0.6 : 0;
  const ringR = style === 'circle' ? g + size * 0.6 : 0;

  const layer = (stroke, extra) => (
    <g stroke={stroke} fill="none" strokeWidth={t + extra}>
      {lines.map(([x1, y1, x2, y2], i) => {
        // el contorno sobresale un poco por los extremos
        const ex = Math.sign(x2 - x1) * (extra / 2);
        const ey = Math.sign(y2 - y1) * (extra / 2);
        return <line key={i} x1={x1 - ex} y1={y1 - ey} x2={x2 + ex} y2={y2 + ey} />;
      })}
      {ringR > 0 && <circle r={ringR} />}
      {dotR > 0 && <circle r={dotR + extra / 2} fill={stroke} stroke="none" />}
    </g>
  );

  return (
    <svg className={className} width={half * 2} height={half * 2} viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}>
      <g transform={style === 'x' ? 'rotate(45)' : undefined}>
        {outline && layer('rgba(0,0,0,0.75)', 2)}
        {layer(color, 0)}
      </g>
    </svg>
  );
}
