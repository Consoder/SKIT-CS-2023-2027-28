import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-400">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-300">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context); nothing else to do.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`no-print inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${className}`}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

// Accessible tab bar (roving arrow-key focus).
export function Tabs({ tabs, active, onChange, label }) {
  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === active);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      onChange(tabs[next].key);
      document.getElementById(`tab-${tabs[next].key}`)?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="scroll-thin no-print -mx-1 flex gap-1 overflow-x-auto border-b border-slate-800 px-1">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:bg-slate-800 ${
              selected ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({ label, value, icon: Icon, hint, delta, deltaGoodWhenUp = true }) {
  let deltaNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const up = delta >= 0;
    const good = up === deltaGoodWhenUp;
    deltaNode = (
      <span className={`text-xs font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(0)}% vs prev. 7 days
      </span>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
      <div className="mt-1 min-h-4">{deltaNode ?? (hint && <span className="text-xs text-slate-500">{hint}</span>)}</div>
    </div>
  );
}

// Labelled horizontal bars — identity comes from the row label, not colour.
export function BarList({ items, emptyText = 'No data yet.', color = '#3987e5', format = (v) => v }) {
  if (!items.length || items.every((item) => !item.value)) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.key ?? item.label} title={`${item.label}: ${format(item.value)}`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className={`flex min-w-0 items-center gap-1.5 ${item.textClass ?? 'text-slate-300'}`}>
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-white">{format(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800/80" aria-hidden="true">
              <div
                className="print-keep-bar h-full rounded-full transition-[width] duration-500"
                style={{ width: `${item.value ? Math.max((item.value / max) * 100, 2) : 0}%`, background: item.color ?? color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DetailList({ rows }) {
  return (
    <dl className="divide-y divide-slate-800/80">
      {rows.map(({ label, value, mono, tone }) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2 text-sm">
          <dt className="shrink-0 text-slate-400">{label}</dt>
          <dd className={`min-w-0 break-all text-right font-medium ${tone ?? 'text-white'} ${mono ? 'font-mono text-xs leading-5' : ''}`}>
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = 'info', icon: Icon, children }) {
  const tones = {
    info: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
    warn: 'border-amber-400/30 bg-amber-400/5 text-amber-200',
    danger: 'border-red-500/30 bg-red-500/5 text-red-200',
    good: 'border-green-500/30 bg-green-500/5 text-green-200',
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
