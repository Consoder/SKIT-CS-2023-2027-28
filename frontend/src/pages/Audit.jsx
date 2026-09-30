import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileJson, Link2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { VerdictBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import Card from '../components/Card';
import { CopyButton, EmptyState, Notice, PageHeader, StatTile } from '../components/Common';
import { exportJson } from '../lib/exporters';
import { formatDateTime, truncateMiddle } from '../lib/format';
import { GENESIS_HASH, shortHash, verifyLedger } from '../lib/ledger';
import { useAppStore } from '../store/appStoreContext';

const PAGE_SIZE = 12;

export default function Audit() {
  const { ledger, scans, tamperLedger, restoreLedger, tamperedIndex, settings } = useAppStore();
  const [report, setReport] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(0);

  const scanIds = useMemo(() => new Set(scans.map((scan) => scan.id)), [scans]);
  const newestFirst = useMemo(() => [...ledger].reverse(), [ledger]);
  const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  const visible = newestFirst.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const verify = async () => {
    setVerifying(true);
    setReport(await verifyLedger(ledger));
    setVerifying(false);
  };

  // Re-verify automatically whenever the chain changes.
  useEffect(() => {
    let cancelled = false;
    verifyLedger(ledger).then((result) => {
      if (!cancelled) setReport(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ledger]);

  if (!ledger.length) {
    return (
      <div>
        <PageHeader title="Blockchain audit log" description="A tamper-evident record of every verdict." />
        <EmptyState icon={Link2} title="The audit chain is empty" description="Every scan appends a SHA-256 hash-chained record here.">
          <ButtonLink to="/scan">Scan a URL</ButtonLink>
        </EmptyState>
      </div>
    );
  }

  const brokenAt = report && !report.valid ? report.firstBrokenIndex : null;
  const statusOf = (index) => report?.results[index];

  return (
    <div>
      <PageHeader
        title="Blockchain audit log"
        description="Each record stores the hash of the one before it, so changing any past verdict breaks every hash after it."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => exportJson(ledger, 'urlshield-audit-chain')}>
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> Export chain
            </Button>
            <Button size="sm" onClick={verify} disabled={verifying}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {verifying ? 'Verifying…' : 'Verify integrity'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Records" value={ledger.length.toLocaleString()} icon={Link2} hint="Deleting history never removes records" />
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Integrity</p>
          {report ? (
            report.valid ? (
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-green-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> Intact
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-red-400">
                <XCircle className="h-6 w-6" aria-hidden="true" /> Broken at #{report.firstBrokenIndex}
              </p>
            )
          ) : (
            <p className="mt-2 text-2xl font-bold text-slate-500">Checking…</p>
          )}
          <p className="mt-1 text-xs text-slate-500">{report ? `${report.checked} hashes recomputed` : ''}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Chain head</p>
          <p className="mt-2 flex items-center gap-1 font-mono text-sm text-white">
            {shortHash(ledger.at(-1).hash, 10)}
            <CopyButton value={ledger.at(-1).hash} label="Copy head hash" />
          </p>
          <p className="mt-1 text-xs text-slate-500">Anchor target for the Sprint 6.4 smart contract</p>
        </div>
      </div>

      {brokenAt !== null && (
        <div className="mt-6">
          <Notice tone="danger" icon={AlertTriangle}>
            Record #{brokenAt} no longer matches its hash, and every later record depends on it. In production this is the
            signal that stored scan evidence was edited after the fact.
          </Notice>
        </div>
      )}

      {settings.mode === 'demo' && (
        <Card title="Tamper-detection demo" icon={AlertTriangle} className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm text-slate-400">
              Quietly rewrite a stored verdict to “Benign” without updating its hash — the way an attacker covering their
              tracks would — then watch verification catch it. Restore puts the original record back.
            </p>
            <div className="flex shrink-0 gap-2">
              {tamperedIndex === null ? (
                <Button size="sm" variant="danger" onClick={tamperLedger}>
                  Tamper with a record
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={restoreLedger}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore record #{tamperedIndex}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="scroll-thin mt-6 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Audit chain records, newest first</caption>
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">#</th>
              <th scope="col" className="px-4 py-3 font-medium">Recorded</th>
              <th scope="col" className="px-4 py-3 font-medium">URL</th>
              <th scope="col" className="px-4 py-3 font-medium">Verdict</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Risk</th>
              <th scope="col" className="px-4 py-3 font-medium">Hash</th>
              <th scope="col" className="px-4 py-3 font-medium">Prev hash</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((entry) => {
              const status = statusOf(entry.index);
              const downstream = brokenAt !== null && entry.index > brokenAt;
              return (
                <tr key={entry.index} className={status && !status.ok ? 'bg-red-500/5' : ''}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{entry.index}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">{formatDateTime(entry.timestamp)}</td>
                  <td className="max-w-[240px] px-4 py-2.5">
                    {scanIds.has(entry.scanId) ? (
                      <Link to={`/results/${entry.scanId}`} className="block truncate font-mono text-xs text-slate-200 hover:underline" title={entry.url}>
                        {truncateMiddle(entry.url, 48)}
                      </Link>
                    ) : (
                      <span className="block truncate font-mono text-xs text-slate-400" title={`${entry.url} (removed from history)`}>
                        {truncateMiddle(entry.url, 48)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <VerdictBadge verdict={entry.verdict} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white">{entry.riskScore}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-300">
                    <span className="inline-flex items-center">
                      {shortHash(entry.hash, 6)}
                      <CopyButton value={entry.hash} label="Copy hash" />
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{entry.prevHash === GENESIS_HASH ? 'genesis' : shortHash(entry.prevHash, 6)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {!status ? (
                      <span className="text-slate-500">—</span>
                    ) : status.ok ? (
                      downstream ? (
                        <span className="text-amber-300">Untrusted (after break)</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Valid
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {status.hashOk ? 'Broken link' : 'Hash mismatch'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card title="How this becomes a blockchain log" icon={Link2} className="mt-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>Every verdict becomes a record committing to its URL, verdict, risk score, timestamp and the previous record&apos;s hash (SHA-256).</li>
          <li>The backend&apos;s Solidity contract (Sprint 6.4, Ganache + Web3.py) stores each record hash on-chain and returns a transaction receipt.</li>
          <li>Auditors recompute the chain from exported records and compare it against the on-chain hashes — any edit shows up as a mismatch.</li>
        </ol>
      </Card>
    </div>
  );
}
