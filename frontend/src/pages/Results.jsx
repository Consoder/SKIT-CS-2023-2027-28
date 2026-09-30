import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileJson,
  FileSpreadsheet,
  Globe,
  Hash,
  Info,
  Link2,
  Lock,
  Printer,
  RefreshCw,
  SearchX,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SimulatedTag, SourceBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import Card from '../components/Card';
import { CopyButton, DetailList, EmptyState, Notice, Tabs } from '../components/Common';
import RiskGauge from '../components/RiskGauge';
import { SEVERITY_STYLES, getVerdict } from '../config/verdicts';
import { FEATURE_CATALOG, formatFeatureValue } from '../lib/features';
import { exportCsv, exportJson, exportPdf } from '../lib/exporters';
import { formatAge, formatDateTime, formatPercent } from '../lib/format';
import { shortHash, verifyLedger } from '../lib/ledger';
import { useAppStore } from '../store/appStoreContext';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'features', label: 'URL Features' },
  { key: 'network', label: 'IP & DNS' },
  { key: 'whois', label: 'WHOIS & SSL' },
  { key: 'intel', label: 'Threat Intelligence' },
  { key: 'audit', label: 'Audit Record' },
];

const yesNo = (value) => (value === undefined || value === null ? '—' : value ? 'Yes' : 'No');

function Unavailable({ what }) {
  return (
    <p className="py-6 text-center text-sm text-slate-500">
      {what} is not available for this scan yet.
    </p>
  );
}

function Panel({ id, active, children }) {
  // Inactive tabs are still printed so the PDF contains the whole report.
  return (
    <div id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} className={active ? 'mt-6' : 'mt-6 hidden print:block'}>
      {children}
    </div>
  );
}

function SignalList({ signals }) {
  const risky = signals.filter((signal) => signal.weight > 0);
  const trust = signals.filter((signal) => signal.weight <= 0);
  if (!signals.length) {
    return <p className="text-sm text-slate-400">No individual risk signals were reported for this URL.</p>;
  }
  return (
    <ul className="space-y-2">
      {[...risky, ...trust].map((signal) => {
        const severity = SEVERITY_STYLES[signal.severity] ?? SEVERITY_STYLES.low;
        return (
          <li key={signal.id} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
            <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${severity.bg} ${severity.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${severity.dot}`} aria-hidden="true" />
              {severity.label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{signal.label}</p>
              {signal.detail && <p className="mt-0.5 text-xs text-slate-400">{signal.detail}</p>}
            </div>
            {typeof signal.weight === 'number' && (
              <span className={`shrink-0 text-xs font-semibold tabular-nums ${signal.weight > 0 ? 'text-slate-300' : 'text-green-400'}`}>
                {signal.weight > 0 ? `+${signal.weight}` : signal.weight}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FeatureTable({ features }) {
  const rows = useMemo(() => {
    const known = FEATURE_CATALOG.filter((item) => item.key in features);
    const extra = Object.keys(features)
      .filter((key) => !FEATURE_CATALOG.some((item) => item.key === key))
      .map((key) => ({ key, label: key.replace(/_/g, ' '), group: 'Other' }));
    return [...known, ...extra];
  }, [features]);
  const groups = [...new Set(rows.map((row) => row.group))];
  const flagged = rows.filter((row) => row.risky?.(features[row.key])).length;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-400">
        <span className="font-semibold text-white">{flagged}</span> of {rows.length} features are pushing the risk up (highlighted).
        Feature names match the ML pipeline (<code className="font-mono text-xs text-slate-300">ml/src/features.py</code>).
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group} title={group} className="!p-4">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800/80">
                {rows
                  .filter((row) => row.group === group)
                  .map((row) => {
                    const value = features[row.key];
                    const risky = row.risky?.(value);
                    return (
                      <tr key={row.key} className={risky ? 'bg-amber-400/5' : ''}>
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-400">
                          {row.label}
                          <span className="block font-mono text-[11px] text-slate-600">{row.key}</span>
                        </th>
                        <td className={`py-2 text-right font-medium tabular-nums ${risky ? 'text-amber-300' : 'text-slate-100'}`}>
                          {risky && <span className="sr-only">Flagged: </span>}
                          {formatFeatureValue(value, row.format)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VirusTotalBar({ vt }) {
  const parts = [
    { key: 'malicious', label: 'Malicious', value: vt.malicious ?? 0, color: '#d03b3b' },
    { key: 'suspicious', label: 'Suspicious', value: vt.suspicious ?? 0, color: '#fab219' },
    { key: 'harmless', label: 'Harmless', value: vt.harmless ?? 0, color: '#0ca30c' },
    { key: 'undetected', label: 'Undetected', value: vt.undetected ?? 0, color: '#475569' },
  ];
  const total = vt.total || parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-white">
        {vt.malicious ?? 0}
        <span className="text-lg font-medium text-slate-500"> / {vt.total ?? total}</span>
      </p>
      <p className="text-sm text-slate-400">security vendors flagged this URL as malicious</p>
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span key={part.key} className="print-keep-bar h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />
          ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: part.color }} aria-hidden="true" />
            <dt className="text-slate-400">{part.label}</dt>
            <dd className="ml-auto font-semibold tabular-nums text-white sm:ml-0">{part.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AuditPanel({ scan }) {
  const { ledger } = useAppStore();
  const [check, setCheck] = useState(null);
  const entry = scan.ledger ? ledger[scan.ledger.index] : null;

  const verify = async () => {
    setCheck({ running: true });
    const upTo = ledger.slice(0, scan.ledger.index + 1);
    const result = await verifyLedger(upTo);
    const own = result.results[scan.ledger.index];
    const matchesRecord = entry && entry.hash === scan.ledger.hash && entry.verdict === scan.verdict && entry.riskScore === scan.riskScore;
    setCheck({ running: false, ok: result.valid && own?.ok && matchesRecord, result });
  };

  if (!scan.ledger) return <Unavailable what="An audit record" />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card title="Hash-chain record" icon={Hash}>
        <DetailList
          rows={[
            { label: 'Block index', value: `#${scan.ledger.index}` },
            { label: 'Record hash', value: scan.ledger.hash, mono: true },
            { label: 'Previous hash', value: scan.ledger.prevHash, mono: true },
            { label: 'Recorded at', value: formatDateTime(entry?.timestamp ?? scan.scannedAt) },
            { label: 'Committed fields', value: 'index · timestamp · scanId · url · verdict · riskScore · prevHash' },
          ]}
        />
        <div className="no-print mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={verify} disabled={check?.running}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {check?.running ? 'Verifying…' : 'Verify this record'}
          </Button>
          <ButtonLink to="/audit" size="sm" variant="ghost">
            Open audit log
          </ButtonLink>
        </div>
        {check && !check.running && (
          <div className="mt-4">
            {check.ok ? (
              <Notice tone="good" icon={CheckCircle2}>
                Record intact — all {check.result.checked} hashes up to block #{scan.ledger.index} recompute correctly.
              </Notice>
            ) : (
              <Notice tone="danger" icon={XCircle}>
                Integrity check failed
                {check.result.firstBrokenIndex !== null ? ` at block #${check.result.firstBrokenIndex}` : ''} — this record or one before it was modified.
              </Notice>
            )}
          </div>
        )}
      </Card>
      <Card title="On-chain anchor" icon={Link2}>
        {scan.chainReceipt ? (
          <DetailList
            rows={[
              { label: 'Transaction', value: scan.chainReceipt.tx_hash, mono: true },
              { label: 'Block', value: scan.chainReceipt.block_number },
              { label: 'Recorded at', value: formatDateTime(scan.chainReceipt.recorded_at) },
            ]}
          />
        ) : (
          <p className="text-sm text-slate-400">
            The Solidity audit contract (Sprint 6.4) will anchor this hash on the Ganache/Ethereum chain and return a
            transaction receipt here. Until then the record is protected by the local SHA-256 hash chain.
          </p>
        )}
      </Card>
    </div>
  );
}

// Analysis Results Dashboard for a single scan.
export default function Results() {
  const { id } = useParams();
  const { getScan, scans } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const scan = id ? getScan(id) : null;

  if (!id) {
    return scans.length ? <Navigate to={`/results/${scans[0].id}`} replace /> : <Navigate to="/scan" replace />;
  }

  if (!scan) {
    return (
      <EmptyState icon={SearchX} title="Scan not found" description="This result isn't in your local history. It may have been deleted, or it was scanned in another browser.">
        <ButtonLink to="/scan">Scan a URL</ButtonLink>
        <ButtonLink to="/history" variant="secondary">
          Open history
        </ButtonLink>
      </EmptyState>
    );
  }

  const verdict = getVerdict(scan.verdict);
  const VerdictIcon = verdict.icon;
  const vt = scan.threatIntel?.virustotal;
  const abuse = scan.threatIntel?.abuseipdb;
  const simulated = scan.source !== 'live';
  const fileBase = `urlshield-${scan.hostname || 'scan'}`;

  const facts = [
    { label: 'IP address', value: scan.ip?.address || scan.dns?.ip_address || '—', mono: true },
    { label: 'Hosting', value: scan.ip ? `${scan.ip.country ?? '—'} · ${scan.ip.asn ?? ''}` : '—' },
    { label: 'Domain age', value: scan.whois?.available === false ? 'n/a (IP host)' : formatAge(scan.whois?.domain_age_days) },
    { label: 'HTTPS', value: scan.ssl ? (scan.ssl.enabled ? (scan.ssl.valid ? 'Valid certificate' : 'Invalid certificate') : 'Not used') : '—' },
    { label: 'VirusTotal', value: vt ? `${vt.malicious} / ${vt.total} engines` : '—', tone: vt?.malicious ? 'text-red-300' : undefined },
    { label: 'AbuseIPDB', value: abuse ? `${abuse.abuse_confidence_score} / 100` : '—', tone: abuse?.abuse_confidence_score >= 50 ? 'text-red-300' : undefined },
  ];

  return (
    <div className="print-area">
      <div className="no-print mb-4">
        <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Scan history
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analysis result</p>
          <div className="mt-1 flex items-start gap-1">
            <h1 className="min-w-0 break-all font-mono text-lg font-semibold text-white sm:text-xl">{scan.url}</h1>
            <CopyButton value={scan.url} label="Copy URL" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {formatDateTime(scan.scannedAt)}
            </span>
            <span className="font-mono">ID {scan.id.slice(0, 8)}</span>
            {scan.durationMs !== null && <span>{scan.durationMs} ms</span>}
            <SourceBadge source={scan.source} />
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/scan?url=${encodeURIComponent(scan.url)}&auto=1`)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Rescan
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportJson(scan, fileBase)}>
            <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> JSON
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportCsv([scan], fileBase)}>
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportPdf(`${fileBase}-report`)}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> PDF
          </Button>
          <ButtonLink to="/scan" size="sm">
            New scan
          </ButtonLink>
        </div>
      </div>

      {simulated && (
        <div className="no-print mb-6">
          <Notice tone="info" icon={Info}>
            Demo mode: URL features are computed for real, but the verdict comes from a rule-based stand-in for the ML model,
            and DNS, WHOIS, IP and threat-intel values are simulated. Values marked <span className="font-semibold">Simulated</span> will come from live lookups once the backend is connected.
          </Notice>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`rounded-xl border p-6 ${verdict.border} ${verdict.bg}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Verdict</p>
          <div className="mt-3 flex items-center gap-3">
            <VerdictIcon className={`h-10 w-10 ${verdict.text}`} aria-hidden="true" />
            <p className={`text-3xl font-bold ${verdict.text}`}>{verdict.label}</p>
          </div>
          <p className="mt-3 text-sm text-slate-200">{verdict.summary}</p>
          <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recommended action</p>
            <p className="mt-1 text-sm text-slate-200">{verdict.advice}</p>
          </div>
        </section>

        <section className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="mb-2 self-start text-xs font-semibold uppercase tracking-wider text-slate-400">Risk score</p>
          <RiskGauge score={scan.riskScore} />
          <dl className="mt-4 grid w-full grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-lg bg-slate-950/50 p-2">
              <dt className="text-xs text-slate-500">Confidence</dt>
              <dd className="font-semibold text-white">{formatPercent(scan.confidence)}</dd>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-2">
              <dt className="text-xs text-slate-500">Model</dt>
              <dd className="truncate font-semibold text-white" title={scan.model ? `${scan.model.name} ${scan.model.version ?? ''}` : ''}>
                {scan.model?.version ?? scan.model?.name ?? '—'}
              </dd>
            </div>
          </dl>
        </section>

        <Card title="Key facts" icon={Server} action={<SimulatedTag show={simulated} />}>
          <DetailList rows={facts} />
        </Card>
      </div>

      {/* Details */}
      <div className="mt-8">
        <Tabs tabs={TABS} active={tab} onChange={setTab} label="Result details" />

        <Panel id="overview" active={tab === 'overview'}>
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Card title="Why this verdict" icon={Info}>
              <SignalList signals={scan.signals} />
            </Card>
            <Card title="Evidence summary" icon={ShieldCheck} action={<SimulatedTag show={simulated} />}>
              <DetailList
                rows={[
                  { label: 'Registered domain', value: scan.registrableDomain ?? scan.hostname, mono: true },
                  { label: 'Resolves in DNS', value: yesNo(scan.dns?.is_resolvable) },
                  { label: 'Registrar', value: scan.whois?.registrar ?? '—' },
                  { label: 'Safe Browsing', value: scan.threatIntel?.safeBrowsing?.status ?? '—', tone: scan.threatIntel?.safeBrowsing?.status === 'unsafe' ? 'text-red-300' : undefined },
                  { label: 'Abuse reports', value: abuse ? abuse.total_reports : '—' },
                  { label: 'Risk level', value: scan.riskLevel },
                ]}
              />
            </Card>
          </div>
        </Panel>

        <Panel id="features" active={tab === 'features'}>
          {scan.features ? <FeatureTable features={scan.features} /> : <Unavailable what="Feature data" />}
        </Panel>

        <Panel id="network" active={tab === 'network'}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="IP intelligence" icon={Globe} action={<SimulatedTag show={simulated && Boolean(scan.ip)} />}>
              {scan.ip ? (
                <DetailList
                  rows={[
                    { label: 'IP address', value: scan.ip.address, mono: true },
                    { label: 'ASN', value: scan.ip.asn },
                    { label: 'Organization', value: scan.ip.org },
                    { label: 'Country', value: scan.ip.country },
                  ]}
                />
              ) : (
                <Unavailable what="IP intelligence" />
              )}
            </Card>
            <Card title="DNS records" icon={Server} action={<SimulatedTag show={simulated && Boolean(scan.dns)} />}>
              {scan.dns ? (
                <DetailList
                  rows={[
                    { label: 'Resolvable', value: yesNo(scan.dns.is_resolvable) },
                    { label: 'A record (IPv4)', value: yesNo(scan.dns.has_a_record) },
                    { label: 'AAAA record (IPv6)', value: yesNo(scan.dns.has_aaaa_record) },
                    { label: 'MX record (mail)', value: yesNo(scan.dns.has_mx_record) },
                    { label: 'Resolved IP', value: scan.dns.ip_address || '—', mono: true },
                    { label: 'Private / internal IP', value: yesNo(scan.dns.resolves_to_private_ip), tone: scan.dns.resolves_to_private_ip ? 'text-amber-300' : undefined },
                    { label: 'Name servers', value: scan.dns.nameservers?.join(', ') || '—', mono: true },
                  ]}
                />
              ) : (
                <Unavailable what="DNS data" />
              )}
            </Card>
          </div>
        </Panel>

        <Panel id="whois" active={tab === 'whois'}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="WHOIS" icon={Globe} action={<SimulatedTag show={simulated && Boolean(scan.whois)} />}>
              {scan.whois?.available === false ? (
                <p className="py-6 text-center text-sm text-slate-400">The host is a raw IP address, so there is no domain registration to look up.</p>
              ) : scan.whois ? (
                <DetailList
                  rows={[
                    { label: 'Registrar', value: scan.whois.registrar },
                    { label: 'Created', value: formatDateTime(scan.whois.created_at) },
                    { label: 'Domain age', value: formatAge(scan.whois.domain_age_days), tone: scan.whois.domain_age_days < 90 ? 'text-amber-300' : undefined },
                    { label: 'Expires', value: formatDateTime(scan.whois.expires_at) },
                    { label: 'Privacy-protected', value: yesNo(scan.whois.privacy_protected) },
                  ]}
                />
              ) : (
                <Unavailable what="WHOIS data" />
              )}
            </Card>
            <Card title="SSL / TLS" icon={Lock} action={<SimulatedTag show={simulated && Boolean(scan.ssl)} />}>
              {scan.ssl ? (
                <DetailList
                  rows={[
                    { label: 'HTTPS used', value: yesNo(scan.ssl.enabled), tone: scan.ssl.enabled ? undefined : 'text-amber-300' },
                    { label: 'Certificate valid', value: scan.ssl.enabled ? yesNo(scan.ssl.valid) : 'n/a' },
                    { label: 'Issuer', value: scan.ssl.issuer ?? '—' },
                  ]}
                />
              ) : (
                <Unavailable what="Certificate data" />
              )}
              <p className="mt-4 text-xs text-slate-500">A valid certificate only proves the connection is encrypted — phishing sites routinely use free certificates.</p>
            </Card>
          </div>
        </Panel>

        <Panel id="intel" active={tab === 'intel'}>
          {scan.threatIntel ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <Card title="VirusTotal" icon={ShieldCheck} className="lg:col-span-2" action={<SimulatedTag show={scan.threatIntel.simulated} />}>
                {vt ? <VirusTotalBar vt={vt} /> : <Unavailable what="VirusTotal data" />}
              </Card>
              <div className="space-y-5">
                <Card title="AbuseIPDB" icon={Server} action={<SimulatedTag show={scan.threatIntel.simulated} />}>
                  {abuse ? (
                    <>
                      <p className="text-3xl font-bold tabular-nums text-white">
                        {abuse.abuse_confidence_score}
                        <span className="text-lg font-medium text-slate-500"> / 100</span>
                      </p>
                      <p className="text-sm text-slate-400">abuse confidence for the hosting IP</p>
                      <p className="mt-3 text-sm text-slate-300">{abuse.total_reports} report{abuse.total_reports === 1 ? '' : 's'}{abuse.last_reported_at ? `, last ${formatDateTime(abuse.last_reported_at)}` : ''}</p>
                    </>
                  ) : (
                    <Unavailable what="AbuseIPDB data" />
                  )}
                </Card>
                <Card title="Google Safe Browsing" icon={Lock} action={<SimulatedTag show={scan.threatIntel.simulated} />}>
                  <p className={`text-lg font-semibold capitalize ${scan.threatIntel.safeBrowsing?.status === 'unsafe' ? 'text-red-300' : 'text-white'}`}>
                    {scan.threatIntel.safeBrowsing?.status ?? '—'}
                  </p>
                  <p className="text-sm text-slate-400">{scan.threatIntel.safeBrowsing?.threat_type?.replace(/_/g, ' ').toLowerCase() ?? 'No threat listed'}</p>
                </Card>
              </div>
            </div>
          ) : (
            <Unavailable what="Threat intelligence" />
          )}
        </Panel>

        <Panel id="audit" active={tab === 'audit'}>
          <AuditPanel scan={scan} />
        </Panel>
      </div>

      <p className="mt-8 text-xs text-slate-600">
        Audit hash {shortHash(scan.ledger?.hash)} · Generated by URLShield AI · Verdicts are decision support, not a guarantee.
      </p>
    </div>
  );
}
