import { CheckCircle2, Database, FlaskConical, Radio, Sparkles, Trash2, Wifi, XCircle } from 'lucide-react';
import { useState } from 'react';
import { checkHealth } from '../api/urlApi';
import { DEFAULT_API_BASE_URL } from '../api/axiosClient';
import Button from '../components/Button';
import Card from '../components/Card';
import { Notice, PageHeader } from '../components/Common';
import Input from '../components/Input';
import { BRAND } from '../config/brand';
import { exportJson } from '../lib/exporters';
import { describeApiError } from '../lib/normalize';
import { useAppStore } from '../store/appStoreContext';

function ModeOption({ value, current, onSelect, icon: Icon, title, children }) {
  const selected = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
        selected ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-600'
      }`}
    >
      <input type="radio" name="mode" value={value} checked={selected} onChange={() => onSelect(value)} className="mt-1 accent-indigo-500" />
      <span>
        <span className="flex items-center gap-2 font-medium text-white">
          <Icon className="h-4 w-4" aria-hidden="true" /> {title}
        </span>
        <span className="mt-1 block text-sm text-slate-400">{children}</span>
      </span>
    </label>
  );
}

export default function Settings() {
  const { settings, updateSettings, scans, ledger, clearHistory, resetAll, loadSampleData } = useAppStore();
  const [baseUrl, setBaseUrl] = useState(settings.apiBaseUrl);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);

  const urlError = (() => {
    try {
      const parsed = new URL(baseUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? null : 'Use an http(s) URL.';
    } catch {
      return 'Enter a full URL, e.g. http://localhost:8000/api/v1';
    }
  })();

  const saveBaseUrl = () => {
    if (urlError) return;
    updateSettings({ apiBaseUrl: baseUrl.replace(/\/+$/, '') });
    setHealth(null);
  };

  const test = async () => {
    setHealth({ state: 'checking' });
    try {
      const result = await checkHealth({ baseUrl: baseUrl.replace(/\/+$/, '') });
      setHealth({ state: 'ok', ...result });
    } catch (error) {
      setHealth({ state: 'error', message: describeApiError(error, baseUrl).message });
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Choose where analyses run, and manage the data stored in this browser." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Analysis engine">
          <div className="space-y-3">
            <ModeOption value="demo" current={settings.mode} onSelect={(mode) => updateSettings({ mode })} icon={FlaskConical} title="Demo mode">
              Runs in the browser. Real URL feature extraction with a rule-based verdict; DNS, WHOIS and threat intel are simulated. No backend needed.
            </ModeOption>
            <ModeOption value="live" current={settings.mode} onSelect={(mode) => updateSettings({ mode })} icon={Radio} title="Live API">
              Sends URLs to the FastAPI backend&apos;s <span className="font-mono">POST /analyze</span> for ML classification and live threat intelligence.
            </ModeOption>
          </div>
          {settings.mode === 'live' && (
            <div className="mt-4">
              <Notice tone="warn">
                The backend currently exposes <span className="font-mono">/health</span> only; <span className="font-mono">/analyze</span> is due in Sprint 3.4. Until then live scans will fail with a clear message.
              </Notice>
            </div>
          )}
        </Card>

        <Card title="Backend connection" icon={Wifi}>
          <Input
            id="api-base-url"
            label="API base URL"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            error={urlError}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-slate-500">Default: {DEFAULT_API_BASE_URL} (set VITE_API_BASE_URL at build time)</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={saveBaseUrl} disabled={Boolean(urlError) || baseUrl.replace(/\/+$/, '') === settings.apiBaseUrl}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={test} disabled={Boolean(urlError) || health?.state === 'checking'}>
              {health?.state === 'checking' ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBaseUrl(DEFAULT_API_BASE_URL)}>
              Reset
            </Button>
          </div>
          {health?.state === 'ok' && (
            <div className="mt-4">
              <Notice tone="good" icon={CheckCircle2}>
                Backend is up — /health returned “{health.status}” in {health.latencyMs} ms.
              </Notice>
            </div>
          )}
          {health?.state === 'error' && (
            <div className="mt-4">
              <Notice tone="danger" icon={XCircle}>
                {health.message}
              </Notice>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Start the backend with <span className="font-mono text-slate-300">uvicorn app.main:app --reload</span> in <span className="font-mono">backend/</span>. Its CORS default already allows http://localhost:5173.
          </p>
        </Card>

        <Card title="Local data" icon={Database}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Scans in history</dt>
              <dd className="text-2xl font-bold text-white">{scans.length}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Audit records</dt>
              <dd className="text-2xl font-bold text-white">{ledger.length}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await loadSampleData();
                setBusy(false);
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {busy ? 'Loading…' : 'Load sample data'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportJson({ exportedAt: new Date().toISOString(), scans, ledger }, 'urlshield-backup')} disabled={!scans.length && !ledger.length}>
              Export everything
            </Button>
            <Button size="sm" variant="danger" disabled={!scans.length} onClick={() => window.confirm('Clear scan history? Audit records are kept.') && clearHistory()}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear history
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={!scans.length && !ledger.length}
              onClick={() => window.confirm('Reset everything? This deletes history AND the local audit chain.') && resetAll()}
            >
              Reset all data
            </Button>
          </div>
        </Card>

        <Card title="About">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Project</dt>
              <dd className="text-right text-slate-200">{BRAND.projectTitle}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Project ID</dt>
              <dd className="text-slate-200">{BRAND.projectId}</dd>
            </div>
            {BRAND.team.map((member) => (
              <div key={member.name} className="flex justify-between gap-4">
                <dt className="text-slate-400">{member.name}</dt>
                <dd className="text-right text-slate-200">{member.role}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Mentor</dt>
              <dd className="text-slate-200">{BRAND.mentor}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
