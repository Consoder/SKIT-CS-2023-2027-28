import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeUrl } from '../api/urlApi';
import { describeApiError, normalizeAnalysis } from '../lib/normalize';
import { normalizeUrl, validateUrl } from '../lib/validateUrl';
import { useAppStore } from '../store/appStoreContext';

// The stages mirror the backend pipeline (README "Request Flow" and the
// proposal's high-level flow), so users see what is happening while they wait.
export const PIPELINE_STAGES = [
  { key: 'validate', label: 'Validate & sanitize', detail: 'Scheme, host, port, length, control characters' },
  { key: 'features', label: 'Extract URL features', detail: 'Lexical, host-based and obfuscation features' },
  { key: 'enrich', label: 'DNS & WHOIS enrichment', detail: 'Resolution, records, domain age, registrar' },
  { key: 'intel', label: 'Threat intelligence', detail: 'VirusTotal · AbuseIPDB · Safe Browsing' },
  { key: 'classify', label: 'ML classification', detail: 'Benign · Suspicious · Phishing · Malware' },
  { key: 'score', label: 'Risk scoring', detail: 'Model confidence + intel corroboration' },
  { key: 'audit', label: 'Write audit record', detail: 'SHA-256 hash-chained, tamper-evident' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useScanner() {
  const { settings, saveScan } = useAppStore();
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStage(-1);
    setError(null);
  }, []);

  const scan = useCallback(
    async (input) => {
      const validationError = validateUrl(input);
      if (validationError) {
        setError({ code: 'validation_error', message: validationError });
        setStatus('error');
        return null;
      }

      const url = normalizeUrl(input);
      const { mode, apiBaseUrl } = settings;
      // Demo analysis is instant; pace the stages so the flow is readable.
      const pace = mode === 'demo' ? 260 : 90;

      setError(null);
      setStatus('running');
      setStage(0);

      const outcome = analyzeUrl(url, { mode, baseUrl: apiBaseUrl }).then(
        (response) => ({ ok: true, response }),
        (err) => ({ ok: false, err }),
      );

      for (let i = 0; i <= 4; i += 1) {
        if (!alive.current) return null;
        setStage(i);
        await sleep(pace);
      }

      const result = await outcome;
      if (!alive.current) return null;
      if (!result.ok) {
        setError(describeApiError(result.err, apiBaseUrl));
        setStatus('error');
        return null;
      }

      setStage(5);
      await sleep(pace / 2);
      const normalized = normalizeAnalysis(result.response, { source: mode, submittedUrl: url });
      setStage(6);
      const saved = await saveScan(normalized);
      await sleep(pace / 2);
      if (alive.current) setStatus('done');
      return saved;
    },
    [settings, saveScan],
  );

  return { status, stage, error, scan, reset };
}
