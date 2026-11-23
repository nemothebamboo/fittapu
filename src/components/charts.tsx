import { fmtDate } from '../dates';

export interface Series {
  points: { x: number; y: number }[];
  color: string;
  dashed?: boolean;
  dots?: boolean;
  label: string;
}

const W = 340, H = 180, PL = 34, PR = 8, PT = 10, PB = 22;

export function LineChart({ series, yMin, yMax, xMin, xMax, unit = '' }: { series: Series[]; yMin?: number; yMax?: number; xMin?: number; xMax?: number; unit?: string }) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <p className="muted">Még nincs adat.</p>;
  let y0 = yMin ?? Math.min(...all.map((p) => p.y));
  let y1 = yMax ?? Math.max(...all.map((p) => p.y));
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08;
  y0 -= pad; y1 += pad;
  const x0 = xMin ?? Math.min(...all.map((p) => p.x));
  let x1 = xMax ?? Math.max(...all.map((p) => p.x));
  if (x1 === x0) x1 = x0 + 86400000;
  const sx = (x: number) => PL + ((x - x0) / (x1 - x0)) * (W - PL - PR);
  const sy = (y: number) => PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB);
  const ticks = [0, 0.5, 1].map((t) => y0 + pad + t * (y1 - y0 - 2 * pad));
  const xt = [0, 0.5, 1].map((t) => x0 + t * (x1 - x0));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={PL - 4} y={sy(t) + 3} textAnchor="end" className="axis">{Math.round(t * 10) / 10}</text>
          </g>
        ))}
        {xt.map((t, i) => (
          <text key={t} x={sx(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="axis">{fmtDate(new Date(t))}</text>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.5} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round"
            />
            {s.dots && s.points.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={s.color} />)}
          </g>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.label}><i style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />{s.label}{unit && ''}</span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ bars, target, color = 'var(--accent)' }: { bars: { label: string; value: number }[]; target?: number; color?: string }) {
  if (!bars.length) return <p className="muted">Még nincs adat.</p>;
  const max = Math.max(target ?? 0, ...bars.map((b) => b.value), 1) * 1.1;
  const bw = (W - PL - PR) / bars.length;
  const sy = (y: number) => PT + (1 - y / max) * (H - PT - PB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} className="grid" />
      <text x={PL - 4} y={sy(max / 1.1) + 3} textAnchor="end" className="axis">{Math.round(max / 1.1).toLocaleString('hu-HU')}</text>
      {target != null && <line x1={PL} x2={W - PR} y1={sy(target)} y2={sy(target)} stroke="var(--good)" strokeDasharray="5 4" />}
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={PL + i * bw + bw * 0.15} width={bw * 0.7} y={sy(b.value)} height={Math.max(0, sy(0) - sy(b.value))} rx={3} fill={color} />
          <text x={PL + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis">{b.label}</text>
        </g>
      ))}
    </svg>
  );
}
