import { FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VerdictBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import { BarList, EmptyState, PageHeader } from '../components/Common';
import { BRAND } from '../config/brand';
import { VERDICT_ORDER, VERDICTS, verdictBars } from '../config/verdicts';
import { filterByDays, indicators, summarize, topSignals } from '../lib/analytics';
import { exportCsv, exportJson, exportPdf } from '../lib/exporters';
import { formatDateTime, truncateMiddle } from '../lib/format';
import { shortHash, verifyLedger } from '../lib/ledger';
import { useAppStore } from '../store/appStoreContext';

const RANGES = [
  { key: 7, label: 'Last 7 days' },
  { key: 30, label: 'Last 30 days' },
  { key: 90, label: 'Last 90 days' },
  { key: 0, label: 'All time' },
];

const TABLE_LIMIT = 100;

export default function Reports() {
  const { scans, ledger } = useAppStore();
  const [range, setRange] = useState(30);
  const [threatsOnly, setThreatsOnly] = useState(false);
  const [integrity, setIntegrity] = useState(null);

  const inScope = useMemo(() => {
    const list = filterByDays(scans, range);
    return threatsOnly ? list.filter((scan) => scan.verdict !== 'benign') : list;
  }, [scans, range, threatsOnly]);

  const stats = useMemo(() => summarize(inScope), [inScope]);
  const signals = useMemo(() => topSignals(inScope, 8), [inScope]);
  const iocs = useMemo(() => indicators(inScope).slice(0, 15), [inScope]);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? '';

  const printReport = async () => {
    // Include a fresh integrity check in the printed report.
    setIntegrity(await verifyLedger(ledger));
    setTimeout(() => exportPdf(`urlshield-report-${new Date().toISOString().slice(0, 10)}`), 50);
  };

  if (!scans.length) {
    return (
      <div>
        <PageHeader title="Reports" description="Audit-ready summaries of your scan activity." />
        <EmptyState icon={FileText} title="Nothing to report yet" description="Reports are generated from your scan history.">
          <ButtonLink to="/scan">Scan a URL</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Pick a scope, check the preview, then export. PDF uses your browser's “Save as PDF” print target."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => exportCsv(inScope, 'urlshield-report')} disabled={!inScope.length}>
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!inScope.length}
              onClick={() =>
                exportJson(
                  { generatedAt: new Date().toISOString(), scope: { range: rangeLabel, threatsOnly }, summary: stats, topSignals: signals, indicators: iocs, scans: inScope },
                  'urlshield-report',
                )
              }
            >
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> JSON
            </Button>
            <Button size="sm" onClick={printReport} disabled={!inScope.length}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Export PDF
            </Button>
          </>
        }
      />

      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-800 p-0.5" role="group" aria-label="Report range">
          {RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${range === option.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={threatsOnly} onChange={(event) => setThreatsOnly(event.target.checked)} className="accent-indigo-500" />
          Exclude benign URLs
        </label>
      </div>

      {/* Report preview — this block is what gets printed. */}
      <article className="print-area rounded-xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">{BRAND.name} · Threat detection report</p>
            <h2 className="mt-1 text-2xl font-bold text-white">URL scan summary — {rangeLabel.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Generated {formatDateTime(new Date())} · {BRAND.projectTitle} ({BRAND.projectId})
            </p>
          </div>
          <div className="text-sm text-slate-400 sm:text-right">
            <p>Scope: {threatsOnly ? 'non-benign URLs only' : 'all scans'}</p>
            <p>Audit chain: {ledger.length} records{integrity ? (integrity.valid ? ' · verified intact' : ` · BROKEN at #${integrity.firstBrokenIndex}`) : ''}</p>
            {ledger.length > 0 && <p className="font-mono text-xs">Head {shortHash(ledger.at(-1).hash)}</p>}
          </div>
        </header>

        {!inScope.length ? (
          <p className="py-12 text-center text-sm text-slate-500">No scans in this scope.</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 border-b border-slate-800 py-6 sm:grid-cols-4">
              {[
                ['URLs analyzed', stats.total],
                ['Threats detected', stats.threats],
                ['Detection rate', `${Math.round(stats.detectionRate * 100)}%`],
                ['Average risk', stats.avgRisk],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-8 border-b border-slate-800 py-6 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-sm font-semibold text-white">Verdict breakdown</h3>
                <BarList items={verdictBars(stats.byVerdict)} />
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {VERDICT_ORDER.map((key) => (
                      <tr key={key} className="border-t border-slate-800">
                        <td className="py-1.5 text-slate-300">{VERDICTS[key].label}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-100">{stats.byVerdict[key]}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-500">
                          {stats.total ? `${Math.round((stats.byVerdict[key] / stats.total) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-4 text-sm font-semibold text-white">Most frequent risk signals</h3>
                <BarList items={signals.map((s) => ({ key: s.id, label: s.label, value: s.count }))} emptyText="No risk signals." />
              </div>
            </section>

            {iocs.length > 0 && (
              <section className="border-b border-slate-800 py-6">
                <h3 className="mb-3 text-sm font-semibold text-white">Indicators of compromise (top {iocs.length})</h3>
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs text-slate-500">
                      <tr>
                        <th className="py-1.5 font-medium">Type</th>
                        <th className="py-1.5 font-medium">Indicator</th>
                        <th className="py-1.5 font-medium">Verdict</th>
                        <th className="py-1.5 text-right font-medium">Max risk</th>
                        <th className="py-1.5 text-right font-medium">Hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {iocs.map((ioc) => (
                        <tr key={`${ioc.type}-${ioc.value}`} className="border-t border-slate-800">
                          <td className="py-1.5 uppercase text-slate-400">{ioc.type}</td>
                          <td className="py-1.5 font-mono text-xs text-slate-200">{ioc.value}</td>
                          <td className="py-1.5">
                            <VerdictBadge verdict={ioc.verdict} />
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-100">{ioc.maxRisk}</td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">{ioc.hits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="py-6">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Scan log {inScope.length > TABLE_LIMIT ? `(latest ${TABLE_LIMIT} of ${inScope.length} — full list in CSV/JSON)` : `(${inScope.length})`}
              </h3>
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1.5 font-medium">Scanned</th>
                      <th className="py-1.5 font-medium">URL</th>
                      <th className="py-1.5 font-medium">Verdict</th>
                      <th className="py-1.5 text-right font-medium">Risk</th>
                      <th className="py-1.5 text-right font-medium">Audit hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inScope.slice(0, TABLE_LIMIT).map((scan) => (
                      <tr key={scan.id} className="border-t border-slate-800">
                        <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-slate-400">{formatDateTime(scan.scannedAt)}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs text-slate-200">{truncateMiddle(scan.url, 64)}</td>
                        <td className="py-1.5">
                          <VerdictBadge verdict={scan.verdict} />
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-100">{scan.riskScore}</td>
                        <td className="py-1.5 text-right font-mono text-[11px] text-slate-500">{shortHash(scan.ledger?.hash, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          Verdicts are machine-generated decision support. {scans.some((s) => s.source !== 'live') ? 'Includes demo-mode results with simulated threat intelligence.' : ''}
        </footer>
      </article>
    </div>
  );
}
