import { Download, Globe, Radar, Search, Server } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VerdictBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import Card from '../components/Card';
import { BarList, CopyButton, EmptyState, PageHeader } from '../components/Common';
import Input from '../components/Input';
import { indicators, topAsns, topCountries, topTlds } from '../lib/analytics';
import { downloadFile } from '../lib/exporters';
import { timeAgo } from '../lib/format';
import { useAppStore } from '../store/appStoreContext';

const SOURCES = [
  { name: 'VirusTotal', role: 'URL reputation across ~94 security engines', sprint: 'Sprint 6.1' },
  { name: 'AbuseIPDB', role: 'Community abuse reports for the hosting IP', sprint: 'Sprint 6.1' },
  { name: 'Google Safe Browsing', role: 'Known phishing / malware URL lists', sprint: 'Planned' },
  { name: 'WHOIS', role: 'Domain age, registrar, privacy status', sprint: 'Sprint 1.3' },
  { name: 'DNS resolver', role: 'A / AAAA / MX records, resolved IP', sprint: 'Sprint 1.3' },
];

export default function ThreatIntel() {
  const { scans, settings } = useAppStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const live = settings.mode === 'live';

  const iocs = useMemo(() => indicators(scans), [scans]);
  const countries = useMemo(() => topCountries(scans), [scans]);
  const asns = useMemo(() => topAsns(scans), [scans]);
  const tlds = useMemo(() => topTlds(scans), [scans]);

  const visible = iocs.filter((ioc) => (type === 'all' || ioc.type === type) && (!query || ioc.value.toLowerCase().includes(query.toLowerCase())));

  const exportIocs = () => {
    const lines = ['# URLShield AI — indicators of compromise', `# generated ${new Date().toISOString()}`, '# type,value,verdict,max_risk,hits', ...visible.map((i) => `${i.type},${i.value},${i.verdict},${i.maxRisk},${i.hits}`)];
    downloadFile(`urlshield-iocs-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  };

  return (
    <div>
      <PageHeader title="Threat intelligence" description="Where the threats you've scanned are hosted, and the indicators to block." />

      <Card title="Intelligence sources" icon={Radar} className="mb-6">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SOURCES.map((source) => (
            <li key={source.name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="font-medium text-white">{source.name}</p>
              <p className="mt-1 text-xs text-slate-400">{source.role}</p>
              <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${live ? 'text-teal-300' : 'text-slate-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-teal-300' : 'bg-slate-500'}`} aria-hidden="true" />
                {live ? `Via backend · ${source.sprint}` : 'Simulated in demo mode'}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {!scans.length ? (
        <EmptyState icon={Globe} title="No threat data yet" description="Scan some URLs to see hosting hotspots and indicators here.">
          <ButtonLink to="/scan">Scan a URL</ButtonLink>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Hosting countries (non-benign)" icon={Globe}>
              <BarList items={countries.map((c) => ({ label: c.label, value: c.count }))} emptyText="No risky hosts yet." />
            </Card>
            <Card title="Networks / ASNs (non-benign)" icon={Server}>
              <BarList items={asns.map((c) => ({ label: c.label, value: c.count }))} emptyText="No risky hosts yet." />
            </Card>
            <Card title="Top-level domains (non-benign)" icon={Globe}>
              <BarList items={tlds.map((c) => ({ label: c.label, value: c.count }))} emptyText="No risky domains yet." />
            </Card>
          </div>

          <Card
            title={`Indicators of compromise (${visible.length})`}
            className="mt-6"
            action={
              <Button size="sm" variant="secondary" onClick={exportIocs} disabled={!visible.length}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export blocklist
              </Button>
            }
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-72">
                <Input id="ioc-search" icon={Search} placeholder="Filter indicators" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter indicators" />
              </div>
              <label className="sr-only" htmlFor="ioc-type">
                Indicator type
              </label>
              <select
                id="ioc-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Domains &amp; IPs</option>
                <option value="domain">Domains</option>
                <option value="ip">IP addresses</option>
              </select>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Indicator</th>
                    <th className="py-2 font-medium">Worst verdict</th>
                    <th className="py-2 text-right font-medium">Max risk</th>
                    <th className="py-2 text-right font-medium">Hits</th>
                    <th className="py-2 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visible.slice(0, 100).map((ioc) => (
                    <tr key={`${ioc.type}-${ioc.value}`}>
                      <td className="py-2 text-xs uppercase text-slate-400">{ioc.type}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-200">
                          {ioc.value}
                          <CopyButton value={ioc.value} label={`Copy ${ioc.value}`} />
                        </span>
                      </td>
                      <td className="py-2">
                        <VerdictBadge verdict={ioc.verdict} />
                      </td>
                      <td className="py-2 text-right tabular-nums text-white">{ioc.maxRisk}</td>
                      <td className="py-2 text-right tabular-nums text-slate-400">{ioc.hits}</td>
                      <td className="py-2 text-right text-xs text-slate-500">{timeAgo(ioc.lastSeen)}</td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No indicators match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
