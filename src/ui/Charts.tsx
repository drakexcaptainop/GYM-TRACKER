interface BarPoint {
  label: string;
  value: number;
}

/** Barras SVG simples: sesiones por semana. */
export function BarChart({ data, height = 120, label }: { data: BarPoint[]; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 28;
  const gap = 8;
  const width = data.length * (w + gap);
  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full" role="img" aria-label={label}>
      {data.map((d, i) => {
        const h = (d.value / max) * height;
        const x = i * (w + gap);
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={w} height={Math.max(h, 2)} rx={6} fill={d.value ? "var(--cyan)" : "var(--line)"} />
            <text x={x + w / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface LinePoint {
  label: string;
  value: number | null;
}

/** Línea SVG: evolución de un valor; los puntos sin valor se omiten. */
export function LineChart({ data, height = 140, label }: { data: LinePoint[]; height?: number; label: string }) {
  const points = data.map((d, i) => ({ ...d, i })).filter((d): d is LinePoint & { i: number; value: number } => d.value !== null);
  if (points.length === 0) return <p className="text-sm text-muted">Sin datos todavía.</p>;
  const width = 300;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const x = (i: number) => (data.length === 1 ? width / 2 : 10 + (i / (data.length - 1)) * (width - 20));
  const y = (v: number) => 10 + (1 - (v - min) / span) * (height - 20);
  const path = points.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height + 18}`} className="w-full" role="img" aria-label={label}>
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.value)} r="4" fill="var(--cyan)" />
      ))}
      <text x="10" y={height + 14} fontSize="9" fill="var(--muted)">{data[0]!.label}</text>
      <text x={width - 10} y={height + 14} fontSize="9" textAnchor="end" fill="var(--muted)">{data[data.length - 1]!.label}</text>
    </svg>
  );
}
