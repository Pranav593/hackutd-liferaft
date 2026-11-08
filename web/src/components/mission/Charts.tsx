"use client";

export type Pt = { x: number; y: number };
export type Series = {
  label: string;
  color: string;
  points: Pt[];
  dashed?: boolean;
  width?: number;
  faint?: boolean;
};

export function LineChart({
  series,
  hlines = [],
  vlines = [],
  height = 190,
  yLabel,
  xLabel,
  xDomain,
  yDomain,
  empty = "No data yet",
}: {
  series: Series[];
  hlines?: { y: number; label: string; color: string }[];
  vlines?: { x: number; label: string; color: string }[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  empty?: string;
}) {
  const W = 600;
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const all = series.flatMap((s) => s.points);
  if (!all.length)
    return (
      <div className="chart-empty" style={{ height }}>
        {empty}
      </div>
    );
  const xs = [...all.map((p) => p.x), ...vlines.map((v) => v.x)];
  const ys = [...all.map((p) => p.y), ...hlines.map((h) => h.y)];
  const [x0, x1] = xDomain ?? [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = yDomain ?? [Math.min(...ys), Math.max(...ys)];
  if (y1 - y0 < 1e-6) {
    y0 -= 1;
    y1 += 1;
  }
  const m = (y1 - y0) * 0.08;
  y0 -= yDomain ? 0 : m;
  y1 += yDomain ? 0 : m;
  const sx = (x: number) => pad.l + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => height - pad.b - ((y - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  const path = (pts: Pt[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => y0 + (y1 - y0) * t);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label={yLabel ?? "chart"}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
          <text x={pad.l - 6} y={sy(t) + 4} className="tick" textAnchor="end">
            {Math.abs(t) >= 10 ? t.toFixed(0) : t.toFixed(2)}
          </text>
        </g>
      ))}
      {hlines.map((h) => (
        <g key={h.label}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color} strokeDasharray="5 4" />
          <text x={W - pad.r} y={sy(h.y) - 4} className="tick" textAnchor="end" fill={h.color}>
            {h.label}
          </text>
        </g>
      ))}
      {vlines.map((v) => (
        <g key={v.label}>
          <line x1={sx(v.x)} x2={sx(v.x)} y1={pad.t} y2={height - pad.b} stroke={v.color} strokeWidth={1.5} />
          <text x={sx(v.x) + 4} y={pad.t + 10} className="tick" fill={v.color}>
            {v.label}
          </text>
        </g>
      ))}
      {series.filter((s) => s.points.length > 0).map((s) =>
        s.points.length > 1 ? (
          <path
            key={s.label}
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2.2}
            strokeDasharray={s.dashed ? "4 4" : undefined}
            opacity={s.faint ? 0.55 : 1}
            strokeLinejoin="round"
          />
        ) : (
          <circle key={s.label} cx={sx(s.points[0].x)} cy={sy(s.points[0].y)} r={3.5} fill={s.color} />
        ),
      )}
      {xLabel && (
        <text x={W - pad.r} y={height - 6} className="tick" textAnchor="end">
          {xLabel}
        </text>
      )}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <i style={{ background: i.dashed ? "transparent" : i.color, borderTop: i.dashed ? `2px dashed ${i.color}` : undefined }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
