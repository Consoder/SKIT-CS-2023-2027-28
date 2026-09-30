import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Fingerprint,
  Globe,
  Link2,
  Lock,
  MapPin,
  Minus,
  Network,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { VerdictBadge } from '../components/Badges';
import Layout from '../components/Layout';
import RiskGauge from '../components/RiskGauge';
import ScanForm from '../components/scan/ScanForm';
import { RISK_LEVELS, VERDICT_ORDER, VERDICTS } from '../config/verdicts';
import { PIPELINE_STAGES } from '../hooks/useScanner';

const CAPABILITIES = [
  { value: '30+', label: 'URL features per scan' },
  { value: '4', label: 'Verdict classes' },
  { value: '5', label: 'Intelligence sources' },
  { value: 'SHA-256', label: 'Hash-chained audit log' },
];

const FEATURES = [
  {
    icon: Globe,
    tone: 'bg-blue-500/10 text-blue-300',
    title: 'URL feature analysis',
    description: 'Lexical, host-based and obfuscation features — length, entropy, subdomains, TLD, shorteners, @-tricks, punycode and more.',
  },
  {
    icon: MapPin,
    tone: 'bg-teal-500/10 text-teal-300',
    title: 'IP & domain intelligence',
    description: 'DNS resolution, A/AAAA/MX records, ASN and hosting country, WHOIS domain age and registrar.',
  },
  {
    icon: ShieldCheck,
    tone: 'bg-purple-500/10 text-purple-300',
    title: 'Live threat intelligence',
    description: 'Verdicts corroborated with VirusTotal engine detections, AbuseIPDB abuse confidence and Google Safe Browsing.',
  },
  {
    icon: Brain,
    tone: 'bg-pink-500/10 text-pink-300',
    title: 'ML classification',
    description: 'A trained XGBoost model labels each URL Benign, Suspicious, Phishing or Malware — even links no blacklist has seen.',
  },
  {
    icon: Link2,
    tone: 'bg-orange-500/10 text-orange-300',
    title: 'Blockchain audit trail',
    description: 'Every verdict is written to a tamper-evident hash chain, anchored on Ethereum for forensic-grade evidence.',
  },
  {
    icon: FileText,
    tone: 'bg-sky-500/10 text-sky-300',
    title: 'Analytics & reports',
    description: 'Threat trends, risk distributions and IOC lists, exportable to CSV, JSON and PDF for audits and hand-offs.',
  },
];

// From the proposal's literature survey.
const COMPARISON = {
  columns: ['Google Safe Browsing', 'VirusTotal', 'AbuseIPDB', 'Traditional ML', 'URLShield AI'],
  rows: [
    { label: 'Catches zero-day URLs', values: ['no', 'partial', 'no', 'yes', 'yes'] },
    { label: 'Analyzes URL structure', values: ['no', 'partial', 'no', 'yes', 'yes'] },
    { label: 'IP / hosting reputation', values: ['no', 'partial', 'yes', 'no', 'yes'] },
    { label: 'Live threat-intel corroboration', values: ['yes', 'yes', 'yes', 'no', 'yes'] },
    { label: 'Explains the verdict', values: ['no', 'partial', 'partial', 'no', 'yes'] },
    { label: 'Tamper-evident audit log', values: ['no', 'no', 'no', 'no', 'yes'] },
  ],
};

const FAQ = [
  {
    q: 'How is this different from a blacklist?',
    a: 'Blacklists only block links that have already been reported. We score the URL itself — its structure, host and hosting infrastructure — so a phishing page registered an hour ago can still be flagged.',
  },
  {
    q: 'What do the four verdicts mean?',
    a: 'Benign: no meaningful indicators. Suspicious: risky traits without confirmation. Phishing: credential theft or brand impersonation. Malware: the URL delivers or hosts malicious software.',
  },
  {
    q: 'Is the risk score a probability?',
    a: 'It is a 0–100 score that combines the model’s confidence with threat-intelligence evidence. 0–24 is low, 25–49 medium, 50–74 high, 75–100 critical.',
  },
  {
    q: 'Do you visit the URL?',
    a: 'No page content is executed in your browser. Analysis runs on the URL, DNS/WHOIS data and threat-intel lookups made by the backend.',
  },
  {
    q: 'Why a blockchain?',
    a: 'Security logs are only useful as evidence if nobody can quietly edit them. Each record is hash-chained to the previous one, so any change to history is detectable during forensic review.',
  },
];

function Mark({ value }) {
  if (value === 'yes') return <CheckCircle2 className="mx-auto h-5 w-5 text-green-400" aria-label="Yes" />;
  if (value === 'partial') return <Minus className="mx-auto h-5 w-5 text-amber-300" aria-label="Partial" />;
  return <X className="mx-auto h-5 w-5 text-slate-600" aria-label="No" />;
}

// Static product preview shown beside the hero (illustrative, not a real scan).
function PreviewCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-teal-500/10 via-indigo-500/10 to-transparent blur-2xl" aria-hidden="true" />
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/40" aria-label="Example analysis result">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example result</p>
          <VerdictBadge verdict="phishing" />
        </div>
        <p className="mt-2 break-all font-mono text-xs text-slate-300">http://secure-paypa1-login.com/verify-account</p>
        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-5">
          <RiskGauge score={91} size={140} />
          <ul className="space-y-2 text-xs">
            {[
              ['Impersonates "paypal" with look-alike "1"', 'text-red-300'],
              ['Credential-lure keywords', 'text-red-300'],
              ['Domain registered 6 days ago', 'text-amber-200'],
              ['23 / 94 engines flag it', 'text-amber-200'],
            ].map(([text, tone]) => (
              <li key={text} className={`flex items-start gap-2 ${tone}`}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
          <Lock className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
          Audit record <span className="font-mono text-slate-300">0x8f3a6c2b…abcdef0</span>
        </div>
      </div>
    </div>
  );
}

// Landing page: product pitch + the URL scanner itself (Sprint 2.2).
export default function Home() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-grid relative overflow-hidden border-b border-slate-800/60">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
              <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> ML + IP intelligence + blockchain audit
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Detect <span className="text-teal-300">malicious URLs</span>
              <br />
              before anyone clicks.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-400">
              Paste any link to get a verdict, a 0–100 risk score and the evidence behind it — URL features, IP and
              domain intelligence, and live threat-intel corroboration — in seconds.
            </p>

            <div className="mt-8 max-w-2xl">
              <ScanForm />
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-teal-500" aria-hidden="true" />
              The page is never opened in your browser. Results are saved to your local scan history.
            </p>
          </div>
          <div className="hidden lg:block">
            <PreviewCard />
          </div>
        </div>

        <div className="border-t border-slate-800/60 bg-slate-950/60">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
            {CAPABILITIES.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-slate-400">{item.label}</dt>
                <dd className="mt-1 text-2xl font-bold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">How it works</p>
        <h2 className="mt-2 text-3xl font-bold text-white">One request, seven checks, one verdict</h2>
        <p className="mt-3 max-w-2xl text-slate-400">
          The FastAPI backend runs every submitted URL through the same pipeline, then returns a single, explainable result.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE_STAGES.map((stage, index) => (
            <li key={stage.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-300">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-white">{stage.label}</h3>
              <p className="mt-1 text-sm text-slate-400">{stage.detail}</p>
            </li>
          ))}
          <li className="flex flex-col justify-between rounded-xl border border-teal-500/30 bg-teal-500/5 p-5">
            <div>
              <Database className="h-6 w-6 text-teal-300" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-white">Dashboard &amp; report</h3>
              <p className="mt-1 text-sm text-slate-400">Results land in your history, analytics and exportable reports.</p>
            </div>
            <ButtonLink to="/dashboard" variant="ghost" size="sm" className="mt-4 self-start px-0 text-teal-300 hover:bg-transparent">
              Open dashboard <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </ButtonLink>
          </li>
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Features</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Every signal in one place</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, tone, title, description }) => (
              <article key={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Verdicts */}
      <section id="verdicts" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Verdicts</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Four classes, one clear next step</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VERDICT_ORDER.map((key) => {
            const verdict = VERDICTS[key];
            return (
              <article key={key} className={`rounded-xl border p-5 ${verdict.border} ${verdict.bg}`}>
                <VerdictBadge verdict={key} size="lg" />
                <p className="mt-4 text-sm text-slate-200">{verdict.summary}</p>
                <p className="mt-3 text-xs text-slate-400">{verdict.advice}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <span className="font-medium text-slate-300">Risk score bands:</span>
          {RISK_LEVELS.map((level) => (
            <span key={level.key}>
              <span className={`font-semibold ${level.text}`}>{level.label}</span> {level.min}–{level.max}
            </span>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Why a hybrid approach</p>
          <h2 className="mt-2 text-3xl font-bold text-white">What existing tools miss</h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Each existing service covers one slice of the problem. The gap our literature survey found is combining all of them —
            and keeping the evidence trustworthy.
          </p>
          <div className="scroll-thin mt-8 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Capability comparison with existing solutions</caption>
              <thead className="bg-slate-900/80 text-slate-300">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Capability</th>
                  {COMPARISON.columns.map((column, i) => (
                    <th
                      scope="col"
                      key={column}
                      className={`px-4 py-3 text-center font-medium ${i === COMPARISON.columns.length - 1 ? 'bg-indigo-500/10 text-white' : ''}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {COMPARISON.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-4 py-3 text-left font-normal text-slate-300">{row.label}</th>
                    {row.values.map((value, i) => (
                      <td key={COMPARISON.columns[i]} className={`px-4 py-3 ${i === row.values.length - 1 ? 'bg-indigo-500/5' : ''}`}>
                        <Mark value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold text-white">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-slate-800 rounded-xl border border-slate-800">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-100">
                {item.q}
                <span className="text-slate-500 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 to-teal-500/10 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Scanning lots of links?</h2>
            <p className="mt-1 text-slate-300">Paste or upload up to 50 URLs at once, then export the results.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/scan?tab=bulk">
              <Network className="h-4 w-4" aria-hidden="true" /> Bulk scan
            </ButtonLink>
            <ButtonLink to="/dashboard" variant="secondary">
              View dashboard
            </ButtonLink>
          </div>
        </div>
      </section>
    </Layout>
  );
}
