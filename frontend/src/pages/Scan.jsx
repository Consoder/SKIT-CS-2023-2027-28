import { FileSpreadsheet, FileJson, ListChecks, Play, ScanSearch, Square, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { analyzeUrl } from '../api/urlApi';
import { VerdictBadge } from '../components/Badges';
import Button from '../components/Button';
import Card from '../components/Card';
import { PageHeader, Tabs } from '../components/Common';
import { RiskMeter } from '../components/RiskGauge';
import ScanForm from '../components/scan/ScanForm';
import { exportCsv, exportJson } from '../lib/exporters';
import { describeApiError, normalizeAnalysis } from '../lib/normalize';
import { BULK_LIMIT, parseUrlList } from '../lib/urlList';
import { normalizeUrl, validateUrl } from '../lib/validateUrl';
import { useAppStore } from '../store/appStoreContext';

function BulkScanner() {
  const { settings, saveScan } = useAppStore();
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const stop = useRef(false);
  const fileInput = useRef(null);

  const candidates = parseUrlList(text);
  const tooMany = candidates.length > BULK_LIMIT;
  const finished = rows.filter((row) => row.status === 'done').map((row) => row.scan);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((current) => (current ? `${current}\n${content}` : content));
    event.target.value = '';
  };

  const run = async () => {
    const list = candidates.slice(0, BULK_LIMIT);
    const initial = list.map((url) => {
      const error = validateUrl(url);
      return { url, status: error ? 'invalid' : 'queued', message: error };
    });
    setRows(initial);
    setRunning(true);
    stop.current = false;

    for (let i = 0; i < initial.length; i += 1) {
      if (stop.current) break;
      if (initial[i].status === 'invalid') continue;
      const url = normalizeUrl(initial[i].url);
      setRows((current) => current.map((row, j) => (j === i ? { ...row, status: 'running' } : row)));
      try {
        const response = await analyzeUrl(url, { mode: settings.mode, baseUrl: settings.apiBaseUrl });
        const saved = await saveScan(normalizeAnalysis(response, { source: settings.mode, submittedUrl: url }));
        setRows((current) => current.map((row, j) => (j === i ? { ...row, status: 'done', scan: saved } : row)));
      } catch (error) {
        const { message } = describeApiError(error, settings.apiBaseUrl);
        setRows((current) => current.map((row, j) => (j === i ? { ...row, status: 'failed', message } : row)));
      }
    }
    setRows((current) => current.map((row) => (row.status === 'queued' ? { ...row, status: 'skipped' } : row)));
    setRunning(false);
  };

  const done = rows.filter((row) => !['queued', 'running'].includes(row.status)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Card title="URLs to scan" icon={ListChecks}>
        <label htmlFor="bulk-urls" className="sr-only">
          URLs, one per line
        </label>
        <textarea
          id="bulk-urls"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={running}
          rows={12}
          spellCheck={false}
          placeholder={'One URL per line, e.g.\nhttps://example.com\nhttp://secure-login.example.tk/verify'}
          className="scroll-thin w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 p-3 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className={tooMany ? 'text-amber-300' : 'text-slate-400'}>
            {candidates.length} unique URL{candidates.length === 1 ? '' : 's'}
            {tooMany ? ` — only the first ${BULK_LIMIT} will be scanned` : ` (max ${BULK_LIMIT})`}
          </span>
          <div className="flex gap-2">
            <input ref={fileInput} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={onFile} />
            <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={running}>
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Upload .txt / .csv
            </Button>
            {running ? (
              <Button size="sm" variant="danger" onClick={() => (stop.current = true)}>
                <Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={run} disabled={!candidates.length}>
                <Play className="h-3.5 w-3.5" aria-hidden="true" /> Scan all
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={rows.length ? `Results · ${done}/${rows.length}` : 'Results'}
        icon={ScanSearch}
        action={
          finished.length > 0 && !running ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => exportCsv(finished, 'urlshield-bulk')}>
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> CSV
              </Button>
              <Button size="sm" variant="secondary" onClick={() => exportJson(finished, 'urlshield-bulk')}>
                <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> JSON
              </Button>
            </div>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Paste URLs or upload a file, then press “Scan all”.</p>
        ) : (
          <>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full rounded-full bg-indigo-500 transition-[width]" style={{ width: `${(done / rows.length) * 100}%` }} />
            </div>
            <ul className="scroll-thin max-h-[440px] divide-y divide-slate-800 overflow-auto" aria-live="polite">
              {rows.map((row, index) => (
                <li key={`${row.url}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300" title={row.url}>
                    {row.status === 'done' ? (
                      <Link to={`/results/${row.scan.id}`} className="hover:text-white hover:underline">
                        {row.url}
                      </Link>
                    ) : (
                      row.url
                    )}
                  </span>
                  {row.status === 'done' && (
                    <>
                      <RiskMeter score={row.scan.riskScore} />
                      <VerdictBadge verdict={row.scan.verdict} />
                    </>
                  )}
                  {row.status === 'running' && <span className="text-xs text-indigo-300">Analyzing…</span>}
                  {row.status === 'queued' && <span className="text-xs text-slate-500">Queued</span>}
                  {row.status === 'skipped' && <span className="text-xs text-slate-500">Skipped</span>}
                  {(row.status === 'invalid' || row.status === 'failed') && (
                    <span className="max-w-[45%] truncate text-xs text-red-400" title={row.message}>
                      {row.status === 'invalid' ? 'Invalid' : 'Failed'}: {row.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

export default function Scan() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'bulk' ? 'bulk' : 'single';
  const prefill = params.get('url') ?? '';
  const auto = params.get('auto') === '1' && prefill;

  return (
    <div>
      <PageHeader
        title="Scan URLs"
        description="Check a single link in detail, or triage a batch. Every result is saved to your history and written to the audit chain."
      />
      <Tabs
        label="Scan type"
        active={tab}
        onChange={(key) => setParams(key === 'bulk' ? { tab: 'bulk' } : {})}
        tabs={[
          { key: 'single', label: 'Single URL' },
          { key: 'bulk', label: 'Bulk scan' },
        ]}
      />
      <div className="mt-6" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'single' ? (
          <Card>
            <ScanForm key={prefill} initialUrl={prefill} autoFocus={!auto} autoStart={Boolean(auto)} showExamples={!auto} />
            <p className="mt-6 text-xs text-slate-500">
              Accepted: http(s) URLs up to 2,048 characters. A URL without a scheme is treated as http://, the same as the backend.
            </p>
          </Card>
        ) : (
          <BulkScanner />
        )}
      </div>
    </div>
  );
}
