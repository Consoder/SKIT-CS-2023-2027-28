import { Activity, ArrowRight, Bug, Database, Gauge, ScanSearch, ShieldAlert, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { VerdictBadge } from '../components/Badges';
import Button, { ButtonLink } from '../components/Button';
import Card from '../components/Card';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';
import { BarList, EmptyState, PageHeader, StatTile } from '../components/Common';
import { RiskMeter } from '../components/RiskGauge';
import ScanForm from '../components/scan/ScanForm';
import { verdictBars } from '../config/verdicts';
import { dailySeries, filterByDays, periodDelta, riskDistribution, summarize, topSignals } from '../lib/analytics';
import { formatNumber, timeAgo, truncateMiddle } from '../lib/format';
import { useAppStore } from '../store/appStoreContext';

const RANGES = [
  { key: 7, label: '7 days' },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
];

const RISK_HEX = { low: '#0ca30c', medium: '#fab219', high: '#ec835a', critical: '#d03b3b' };

export default function Dashboard() {
  const { scans, loadSampleData } = useAppStore();
  const [range, setRange] = useState(14);
  const [loading, setLoading] = useState(false);

  const inRange = useMemo(() => filterByDays(scans, range), [scans, range]);
  const stats = useMemo(() => summarize(inRange), [inRange]);
  const series = useMemo(() => dailySeries(scans, range), [scans, range]);
  const distribution = useMemo(() => riskDistribution(inRange), [inRange]);
  const signals = useMemo(() => topSignals(inRange), [inRange]);

  const labels = series.map((bucket) => bucket.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }));

  const loadSamples = async () => {
    setLoading(true);
    await loadSampleData();
    setLoading(false);
  };

  if (!scans.length) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Detection metrics, threat trends and recent activity." />
        <EmptyState
          icon={Activity}
          title="No scans yet"
          description="Scan your first URL to start building analytics, or load a sample dataset of 40 benign and malicious URLs to explore the dashboard."
        >
          <ButtonLink to="/scan">
            <ScanSearch className="h-4 w-4" aria-hidden="true" /> Scan a URL
          </ButtonLink>
          <Button variant="secondary" onClick={loadSamples} disabled={loading}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {loading ? 'Loading…' : 'Load sample data'}
          </Button>
        </EmptyState>
      </div>
    );
  }

  const threatDelta = periodDelta(scans, 7, (list) => list.filter((s) => s.verdict === 'phishing' || s.verdict === 'malware').length);
  const scanDelta = periodDelta(scans, 7, (list) => list.length);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Detection metrics, threat trends and recent activity."
        actions={
          <div className="flex rounded-lg border border-slate-800 p-0.5" role="group" aria-label="Time range">
            {RANGES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRange(option.key)}
                aria-pressed={range === option.key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === option.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <Card className="mb-6">
        <p className="mb-3 text-sm font-semibold text-white">Quick scan</p>
        <ScanForm showExamples={false} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="URLs analyzed" value={formatNumber(stats.total)} icon={Database} delta={range === 7 ? scanDelta : null} hint={`Last ${range} days`} />
        <StatTile
          label="Threats detected"
          value={formatNumber(stats.threats)}
          icon={ShieldAlert}
          delta={range === 7 ? threatDelta : null}
          deltaGoodWhenUp={false}
          hint={`${stats.byVerdict.phishing} phishing · ${stats.byVerdict.malware} malware`}
        />
        <StatTile label="Detection rate" value={`${Math.round(stats.detectionRate * 100)}%`} icon={Bug} hint="Share of scans classed as threats" />
        <StatTile label="Average risk score" value={stats.avgRisk} icon={Gauge} hint="0 (safe) – 100 (critical)" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Scans per day" className="xl:col-span-2">
          <TimeSeriesChart type="bar" labels={labels} values={series.map((b) => b.count)} label="Scans" unit="scans" />
        </Card>
        <Card title="Verdict breakdown">
          <BarList items={verdictBars(stats.byVerdict)} emptyText="No scans in this range." />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Average risk score per day" className="xl:col-span-2">
          <TimeSeriesChart type="line" labels={labels} values={series.map((b) => b.avgRisk)} label="Average risk" yMax={100} />
        </Card>
        <Card title="Risk distribution">
          <BarList
            items={distribution.map((level) => ({
              key: level.key,
              label: `${level.label} (${level.min}–${level.max})`,
              value: level.count,
              color: RISK_HEX[level.key],
            }))}
            emptyText="No scans in this range."
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Most frequent risk signals">
          <BarList items={signals.map((signal) => ({ key: signal.id, label: signal.label, value: signal.count }))} emptyText="No risk signals in this range." />
        </Card>
        <Card
          title="Recent scans"
          className="xl:col-span-2"
          padded={false}
          action={
            <Link to="/history" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <ul className="divide-y divide-slate-800 border-t border-slate-800">
            {scans.slice(0, 7).map((scan) => (
              <li key={scan.id}>
                <Link to={`/results/${scan.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-800/40 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-slate-200">{truncateMiddle(scan.url, 70)}</span>
                    <span className="text-xs text-slate-500">{timeAgo(scan.scannedAt)}</span>
                  </span>
                  <span className="hidden sm:block">
                    <RiskMeter score={scan.riskScore} />
                  </span>
                  <VerdictBadge verdict={scan.verdict} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
