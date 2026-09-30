import { Code2 } from 'lucide-react';
import Card from '../components/Card';
import { CopyButton, PageHeader } from '../components/Common';
import { useAppStore } from '../store/appStoreContext';

// The request/response contract the frontend is built against. It extends
// the backend's current URLAnalysisResponse (url, verdict, risk_score,
// evidence: dict) by specifying what goes inside `evidence`. Every evidence
// key is optional — the UI shows "Not available" for anything missing.
const REQUEST = `{
  "url": "http://secure-paypa1-login.com/verify-account"
}`;

const RESPONSE = `{
  "url": "http://secure-paypa1-login.com/verify-account",
  "verdict": "phishing",              // benign | suspicious | phishing | malware
  "risk_score": 91,                   // 0–100
  "evidence": {
    "scan_id": "7d0c…",               // optional; UI generates one otherwise
    "analyzed_at": "2026-09-30T10:14:03Z",
    "duration_ms": 842,
    "confidence": 0.94,               // 0–1, model probability of the verdict
    "model": { "name": "xgboost-4class", "version": "1.0.0" },
    "host": { "hostname": "secure-paypa1-login.com", "registrable_domain": "secure-paypa1-login.com" },
    "features": { "url_length": 46, "num_hyphens": 2, "has_ip_address": false, "...": "ml/src/features.py names" },
    "signals": [
      { "id": "brand_impersonation", "label": "Impersonates the \\"paypal\\" brand",
        "severity": "high", "weight": 32, "detail": "…" }
    ],
    "dns":   { "is_resolvable": true, "has_a_record": true, "has_aaaa_record": false,
               "has_mx_record": false, "ip_address": "185.143.223.45",
               "resolves_to_private_ip": false, "nameservers": ["ns1.example.net"] },
    "ip":    { "address": "185.143.223.45", "asn": "AS9009", "org": "M247 Europe SRL",
               "country": "Romania", "country_code": "RO" },
    "whois": { "registrar": "NameSilo, LLC", "created_at": "2026-09-24T00:00:00Z",
               "domain_age_days": 6, "expires_at": "…", "privacy_protected": true },
    "ssl":   { "enabled": false, "valid": false, "issuer": null },
    "threat_intel": {
      "virustotal":    { "malicious": 23, "suspicious": 3, "harmless": 45, "undetected": 23, "total": 94 },
      "abuseipdb":     { "abuse_confidence_score": 85, "total_reports": 140, "last_reported_at": "…" },
      "safe_browsing": { "status": "unsafe", "threat_type": "SOCIAL_ENGINEERING" }
    },
    "audit": { "tx_hash": "0x8f3a…", "block_number": 7839251, "recorded_at": "…" }
  }
}`;

const ERROR = `// 422 — from backend/app/core/errors.py
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [{ "loc": ["body", "url"], "msg": "Value error, url scheme must be http or https" }]
  }
}`;

function CodeBlock({ code, label }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2">
        <CopyButton value={code} label={`Copy ${label}`} />
      </div>
      <pre className="scroll-thin overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocs() {
  const { settings } = useAppStore();
  const curl = `curl -X POST ${settings.apiBaseUrl}/analyze \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "http://secure-paypa1-login.com/verify-account"}'`;

  return (
    <div>
      <PageHeader
        eyebrow="Developer"
        title="API access"
        description="The REST contract between this dashboard and the FastAPI backend. Anything the dashboard can do, a script can do too."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card title="Endpoints" icon={Code2}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                {[
                  ['GET', '/health', 'Liveness check', 'Available'],
                  ['POST', '/analyze', 'Analyze one URL', 'Sprint 3.4'],
                  ['GET', '/history', 'Stored analyses', 'Sprint 6.3'],
                ].map(([method, path, purpose, status]) => (
                  <tr key={path}>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${method === 'GET' ? 'bg-sky-500/15 text-sky-300' : 'bg-green-500/15 text-green-300'}`}>{method}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-200">{path}</td>
                    <td className="py-2 pr-3 text-slate-400">{purpose}</td>
                    <td className="py-2 text-right text-xs text-slate-500">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">
              Base URL: <span className="font-mono text-slate-300">{settings.apiBaseUrl}</span> (change in Settings). Interactive docs: <span className="font-mono">/docs</span> on the backend host.
            </p>
          </Card>

          <Card title="Example request">
            <CodeBlock code={curl} label="curl command" />
            <p className="mb-2 mt-4 text-xs font-medium text-slate-400">Body</p>
            <CodeBlock code={REQUEST} label="request body" />
          </Card>

          <Card title="Errors">
            <p className="mb-3 text-sm text-slate-400">Every error — validation, domain or unexpected — uses one envelope, and never includes a stack trace.</p>
            <CodeBlock code={ERROR} label="error example" />
          </Card>
        </div>

        <Card title="Response · 200 OK">
          <p className="mb-3 text-sm text-slate-400">
            <span className="font-mono text-slate-200">url</span>, <span className="font-mono text-slate-200">verdict</span> and{' '}
            <span className="font-mono text-slate-200">risk_score</span> match <span className="font-mono">URLAnalysisResponse</span> today. The{' '}
            <span className="font-mono text-slate-200">evidence</span> keys below are the proposed contract; all of them are optional.
          </p>
          <CodeBlock code={RESPONSE} label="response example" />
        </Card>
      </div>
    </div>
  );
}
