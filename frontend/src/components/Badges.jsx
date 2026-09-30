import { FlaskConical, Radio } from 'lucide-react';
import { getVerdict } from '../config/verdicts';

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

// Verdict chip: icon + label + status colour (never colour alone).
export function VerdictBadge({ verdict, size = 'sm' }) {
  const style = getVerdict(verdict);
  const Icon = style.icon;
  const sizing = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold ${sizing} ${style.bg} ${style.border} ${style.text}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {style.label}
    </span>
  );
}

// Marks data that came from the demo engine rather than a real lookup.
export function SimulatedTag({ show = true, label = 'Simulated' }) {
  if (!show) return null;
  return (
    <span
      title="Demo mode: this value is generated locally from the URL, not fetched from the real service."
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-[11px] font-medium text-slate-400"
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function SourceBadge({ source }) {
  if (source === 'live') {
    return (
      <Badge className="border border-teal-500/30 bg-teal-500/10 text-teal-300">
        <Radio className="h-3 w-3" aria-hidden="true" />
        Live API
      </Badge>
    );
  }
  return (
    <Badge className="border border-slate-700 bg-slate-800/60 text-slate-300">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      {source === 'sample' ? 'Sample data' : 'Demo engine'}
    </Badge>
  );
}
