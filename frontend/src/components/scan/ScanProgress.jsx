import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { PIPELINE_STAGES } from '../../hooks/useScanner';

// Live view of the analysis pipeline while a scan runs.
export default function ScanProgress({ stage, status }) {
  const failed = status === 'error';
  return (
    <ol className="space-y-1" aria-live="polite" aria-label="Analysis progress">
      {PIPELINE_STAGES.map((item, index) => {
        const done = index < stage || status === 'done';
        const current = index === stage && status === 'running';
        const broken = failed && index === stage;
        let Icon = Circle;
        let tone = 'text-slate-600';
        if (done) {
          Icon = CheckCircle2;
          tone = 'text-green-400';
        } else if (current) {
          Icon = Loader2;
          tone = 'text-indigo-300 animate-spin';
        } else if (broken) {
          Icon = XCircle;
          tone = 'text-red-400';
        }
        return (
          <li
            key={item.key}
            className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${current ? 'bg-indigo-500/10' : ''}`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
            <span className={done || current ? 'text-slate-100' : 'text-slate-500'}>{item.label}</span>
            <span className="ml-auto hidden text-xs text-slate-500 sm:inline">{item.detail}</span>
            <span className="sr-only">{done ? 'done' : current ? 'in progress' : broken ? 'failed' : 'pending'}</span>
          </li>
        );
      })}
    </ol>
  );
}
