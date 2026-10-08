import { Search, X } from 'lucide-react';

// Verdict options used by the scan history filters (US3: history page).
export const VERDICT_OPTIONS = ['All', 'Benign', 'Phishing', 'Malware', 'Suspicious'];

// Date range presets, expressed as "number of days back" (null = no limit).
export const DATE_RANGES = [
  { label: 'All time', days: null },
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

// Pure helper: filters a list of scans by search text, verdict and date range.
// Each scan is expected to look like { url, verdict, scannedAt }.
export function filterScans(scans, { query, verdict, days }) {
  const text = query.trim().toLowerCase();
  const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

  return scans.filter((scan) => {
    const matchesText = !text || scan.url.toLowerCase().includes(text);
    const matchesVerdict = verdict === 'All' || scan.verdict === verdict;
    const matchesDate = !cutoff || new Date(scan.scannedAt).getTime() >= cutoff;
    return matchesText && matchesVerdict && matchesDate;
  });
}

// Controlled filter bar. The parent page owns the state and passes it in:
//   <HistoryFilterBar filters={filters} onChange={setFilters} total={n} shown={m} />
export default function HistoryFilterBar({ filters, onChange, total = 0, shown = 0 }) {
  const update = (patch) => onChange({ ...filters, ...patch });
  const isDirty = filters.query || filters.verdict !== 'All' || filters.days;

  const reset = () => onChange({ query: '', verdict: 'All', days: null });

  const fieldStyles =
    'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 ' +
    'focus:border-teal-500 focus:outline-none';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Search by URL..."
            className={`${fieldStyles} w-full pl-9`}
          />
        </div>

        <select
          value={filters.verdict}
          onChange={(event) => update({ verdict: event.target.value })}
          className={fieldStyles}
        >
          {VERDICT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'All' ? 'All verdicts' : option}
            </option>
          ))}
        </select>

        <select
          value={filters.days ?? ''}
          onChange={(event) => update({ days: event.target.value ? Number(event.target.value) : null })}
          className={fieldStyles}
        >
          {DATE_RANGES.map(({ label, days }) => (
            <option key={label} value={days ?? ''}>
              {label}
            </option>
          ))}
        </select>

        {isDirty && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Showing {shown} of {total} scans
      </p>
    </div>
  );
}