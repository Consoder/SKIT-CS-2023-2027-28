import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock,
  Globe,
  Hash,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import Layout from '../components/Layout';

// barFill is spelled out as a full class name (not built with string
// concatenation) so Tailwind's compiler can actually find and generate it.
const VERDICT_STYLES = {
  Benign: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', barFill: 'bg-green-400', label: 'Safe' },
  Suspicious: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', barFill: 'bg-yellow-400', label: 'Suspicious' },
  Phishing: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', barFill: 'bg-red-400', label: 'Phishing' },
  Malware: { icon: Bug, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', barFill: 'bg-orange-400', label: 'Malware' },
};

// Shown when this page is opened directly (no scan just ran), so the dashboard
// layout can be reviewed on its own before /url/analyze exists on the backend.
const SAMPLE_RESULT = {
  url: 'http://secure-paypa1-login.com/verify-account',
  verdict: 'Phishing',
  confidence: 94,
  riskScore: 87,
  lexical: { length: 46, hasIp: false, subdomains: 2, https: false, suspiciousChars: 3 },
  ip: { address: '185.220.101.47', country: 'Russia', isp: 'M247 Ltd', asn: 'AS9009' },
  threatIntel: { virusTotal: { detections: 12, total: 90 }, abuseIpDb: { score: 78 } },
  blockchain: { txHash: '0x8f3a1c7e9b2d4f6a...c92e', block: 19824031, timestamp: new Date().toISOString() },
};

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

// Analysis Results Dashboard: the page Home.jsx navigates to after a scan.
// Renders whatever shape /url/analyze eventually returns (passed via router
// state); falls back to SAMPLE_RESULT so the UI works before that's wired up.
export default function Results() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result ?? SAMPLE_RESULT;
  const verdict = VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES.Suspicious;
  const VerdictIcon = verdict.icon;

  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Analyze another URL
        </Link>

        <div className={`flex flex-col gap-6 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between ${verdict.bg} ${verdict.border}`}>
          <div className="flex items-center gap-4">
            <VerdictIcon className={`h-10 w-10 shrink-0 ${verdict.color}`} />
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${verdict.color}`}>Verdict</p>
              <p className="text-2xl font-bold text-white">{verdict.label}</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-400">{result.url}</p>
            </div>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold text-white">{result.confidence}%</p>
              <p className="text-xs text-slate-400">Confidence</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${verdict.color}`}>{result.riskScore}</p>
              <p className="text-xs text-slate-400">Risk Score</p>
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${verdict.barFill}`}
            style={{ width: `${result.riskScore}%` }}
          />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-400" />
              <h3 className="font-semibold text-white">URL &amp; Lexical Features</h3>
            </div>
            <DetailRow label="Length" value={`${result.lexical.length} chars`} />
            <DetailRow label="Uses raw IP" value={result.lexical.hasIp ? 'Yes' : 'No'} />
            <DetailRow label="Subdomains" value={result.lexical.subdomains} />
            <DetailRow label="HTTPS" value={result.lexical.https ? 'Yes' : 'No'} />
            <DetailRow label="Suspicious characters" value={result.lexical.suspiciousChars} />
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-400" />
              <h3 className="font-semibold text-white">IP Intelligence</h3>
            </div>
            <DetailRow label="IP address" value={result.ip.address} />
            <DetailRow label="Country" value={result.ip.country} />
            <DetailRow label="ISP" value={result.ip.isp} />
            <DetailRow label="ASN" value={result.ip.asn} />
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold text-white">Threat Intelligence</h3>
            </div>
            <DetailRow
              label="VirusTotal detections"
              value={`${result.threatIntel.virusTotal.detections} / ${result.threatIntel.virusTotal.total}`}
            />
            <DetailRow label="AbuseIPDB score" value={`${result.threatIntel.abuseIpDb.score}/100`} />
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Hash className="h-5 w-5 text-orange-400" />
              <h3 className="font-semibold text-white">Blockchain Audit Log</h3>
            </div>
            <DetailRow label="Transaction hash" value={result.blockchain.txHash} />
            <DetailRow label="Block" value={result.blockchain.block} />
            <DetailRow label="Recorded at" value={new Date(result.blockchain.timestamp).toLocaleString()} />
          </Card>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate('/')}>Analyze Another URL</Button>
          <Button variant="secondary" disabled>
            <Clock className="h-4 w-4" />
            Download Report (coming soon)
          </Button>
        </div>
      </section>
    </Layout>
  );
}
