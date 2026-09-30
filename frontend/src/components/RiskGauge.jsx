import { getRiskLevel } from '../config/verdicts';

const LEVEL_HEX = { low: '#0ca30c', medium: '#fab219', high: '#ec835a', critical: '#d03b3b' };

// Semicircular 0–100 risk gauge. The number and level label are text, so the
// arc colour is only a secondary cue.
export default function RiskGauge({ score, size = 180 }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const level = getRiskLevel(value);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const dash = (value / 100) * circumference;
  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <figure className="flex flex-col items-center" aria-label={`Risk score ${value} out of 100, ${level.label} risk`}>
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} role="img" aria-hidden="true">
        <path d={arc} fill="none" stroke="#1e293b" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={LEVEL_HEX[level.key]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="print-keep-bar transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <figcaption className="-mt-12 flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums text-white">{value}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${level.text}`}>{level.label} risk</span>
      </figcaption>
    </figure>
  );
}

// Compact horizontal meter for tables.
export function RiskMeter({ score }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const level = getRiskLevel(value);
  return (
    <div className="flex items-center gap-2" title={`${level.label} risk`}>
      <span className="w-7 text-right text-sm font-semibold tabular-nums text-white">{value}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(value, 3)}%`, background: LEVEL_HEX[level.key] }} />
      </span>
    </div>
  );
}
