import { ChevronLeft, ChevronRight, FileJson, FileSpreadsheet, History as HistoryIcon, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SourceBadge, VerdictBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import { EmptyState, PageHeader } from '../components/Common';
import Input from '../components/Input';
import { RiskMeter } from '../components/RiskGauge';
import { RISK_LEVELS, VERDICT_ORDER, VERDICTS } from '../config/verdicts';
import { exportCsv, exportJson } from '../lib/exporters';
import { formatDateTime, truncateMiddle } from '../lib/format';
import { useAppStore } from '../store/appStoreContext';

const PAGE_SIZE = 15;

const SORTS = {
  newest: (a, b) => new Date(b.scannedAt) - new Date(a.scannedAt),
  oldest: (a, b) => new Date(a.scannedAt) - new Date(b.scannedAt),
  riskDesc: (a, b) => b.riskScore - a.riskScore,
  riskAsc: (a, b) => a.riskScore - b.riskScore,
};

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'border-indigo-400/60 bg-indigo-500/15 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function History() {
  const { scans, removeScans } = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [verdicts, setVerdicts] = useState([]);
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans
      .filter((scan) => !q || scan.url.toLowerCase().includes(q) || scan.ip?.address?.includes(q))
      .filter((scan) => !verdicts.length || verdicts.includes(scan.verdict))
      .filter((scan) => risk === 'all' || scan.riskLevel === risk)
      .sort(SORTS[sort]);
  }, [scans, query, verdicts, risk, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selectedScans = filtered.filter((scan) => selected.has(scan.id));
  const exportTarget = selectedScans.length ? selectedScans : filtered;
  const allVisibleSelected = visible.length > 0 && visible.every((scan) => selected.has(scan.id));

  const resetPage = (fn) => (...args) => {
    fn(...args);
    setPage(0);
  };

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const scan of visible) {
        if (allVisibleSelected) next.delete(scan.id);
        else next.add(scan.id);
      }
      return next;
    });

  const deleteSelected = () => {
    if (!selectedScans.length) return;
    const ok = window.confirm(
      `Delete ${selectedScans.length} scan${selectedScans.length === 1 ? '' : 's'} from history? The audit chain keeps its records.`,
    );
    if (!ok) return;
    removeScans(selectedScans.map((scan) => scan.id));
    setSelected(new Set());
  };

  if (!scans.length) {
    return (
      <div>
        <PageHeader title="Scan history" description="Every URL you have analyzed." />
        <EmptyState icon={HistoryIcon} title="No scans yet" description="Results appear here as soon as you analyze a URL.">
          <ButtonLink to="/scan">Scan a URL</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Scan history"
        description={`${scans.length.toLocaleString()} scans stored in this browser.`}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => exportCsv(exportTarget, 'urlshield-history')} disabled={!exportTarget.length}>
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> CSV{selectedScans.length ? ` (${selectedScans.length})` : ''}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportJson(exportTarget, 'urlshield-history')} disabled={!exportTarget.length}>
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> JSON{selectedScans.length ? ` (${selectedScans.length})` : ''}
            </Button>
            <Button size="sm" variant="danger" onClick={deleteSelected} disabled={!selectedScans.length}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80">
          <Input
            id="history-search"
            icon={Search}
            placeholder="Search URL or IP"
            value={query}
            onChange={(event) => resetPage(setQuery)(event.target.value)}
            aria-label="Search history"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {VERDICT_ORDER.map((key) => {
            const Icon = VERDICTS[key].icon;
            const active = verdicts.includes(key);
            return (
              <FilterChip
                key={key}
                active={active}
                onClick={resetPage(() => setVerdicts((current) => (active ? current.filter((v) => v !== key) : [...current, key])))}
              >
                <Icon className={`h-3.5 w-3.5 ${VERDICTS[key].text}`} aria-hidden="true" /> {VERDICTS[key].label}
              </FilterChip>
            );
          })}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <label className="sr-only" htmlFor="risk-filter">
            Risk level
          </label>
          <select
            id="risk-filter"
            value={risk}
            onChange={(event) => resetPage(setRisk)(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All risk levels</option>
            {RISK_LEVELS.map((level) => (
              <option key={level.key} value={level.key}>
                {level.label} risk
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="sort">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="riskDesc">Highest risk</option>
            <option value="riskAsc">Lowest risk</option>
          </select>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Scan history</caption>
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="w-10 px-4 py-3">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all on this page" className="accent-indigo-500" />
              </th>
              <th scope="col" className="px-4 py-3 font-medium">URL</th>
              <th scope="col" className="px-4 py-3 font-medium">Verdict</th>
              <th scope="col" className="px-4 py-3 font-medium">Risk</th>
              <th scope="col" className="px-4 py-3 font-medium">Scanned</th>
              <th scope="col" className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((scan) => (
              <tr
                key={scan.id}
                className="cursor-pointer transition-colors hover:bg-slate-800/40"
                onClick={(event) => {
                  if (event.target.closest('input,a,button')) return;
                  navigate(`/results/${scan.id}`);
                }}
              >
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(scan.id)} onChange={() => toggle(scan.id)} aria-label={`Select ${scan.url}`} className="accent-indigo-500" />
                </td>
                <td className="max-w-[380px] px-4 py-3">
                  <Link to={`/results/${scan.id}`} className="block truncate font-mono text-xs text-slate-200 hover:text-white hover:underline" title={scan.url}>
                    {truncateMiddle(scan.url, 80)}
                  </Link>
                  <span className="text-xs text-slate-500">{scan.ip?.address ?? scan.hostname}</span>
                </td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={scan.verdict} />
                </td>
                <td className="px-4 py-3">
                  <RiskMeter score={scan.riskScore} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDateTime(scan.scannedAt)}</td>
                <td className="px-4 py-3">
                  <SourceBadge source={scan.source} />
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No scans match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {filtered.length ? `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of ${filtered.length}` : '0 results'}
          {selectedScans.length > 0 && ` · ${selectedScans.length} selected`}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPage(safePage - 1)} disabled={safePage === 0} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
