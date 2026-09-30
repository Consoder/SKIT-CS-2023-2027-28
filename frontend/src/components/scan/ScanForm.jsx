import { AlertCircle, Globe, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useScanner from '../../hooks/useScanner';
import { EXAMPLE_URLS } from '../../lib/sampleData';
import { validateUrl } from '../../lib/validateUrl';
import Button from '../Button';
import { Notice } from '../Common';
import Input from '../Input';
import ScanProgress from './ScanProgress';

// The URL scanner: input + client-side validation + pipeline progress.
// On success it opens the result page (or calls `onComplete`).
export default function ScanForm({ autoFocus = false, showExamples = true, onComplete, initialUrl = '', autoStart = false }) {
  const [url, setUrl] = useState(initialUrl);
  const [touched, setTouched] = useState(false);
  const { status, stage, error, scan, reset } = useScanner();
  const navigate = useNavigate();
  const autoStarted = useRef(false);

  const validationError = validateUrl(url);
  const running = status === 'running';

  const submit = async (value, { replace = false } = {}) => {
    setTouched(true);
    if (validateUrl(value)) return;
    const saved = await scan(value);
    if (!saved) return;
    if (onComplete) onComplete(saved);
    else navigate(`/results/${saved.id}`, { replace });
  };

  // "Rescan" links open /scan?url=…&auto=1 and start immediately.
  useEffect(() => {
    if (!autoStart || !initialUrl || autoStarted.current) return;
    autoStarted.current = true;
    submit(initialUrl, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialUrl]);

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(url);
  };

  const tryExample = (example) => {
    setUrl(example);
    submit(example);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="scan-url" className="sr-only">
            URL to analyze
          </label>
          <Input
            id="scan-url"
            icon={Globe}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            value={url}
            disabled={running}
            onChange={(event) => {
              setUrl(event.target.value);
              if (status === 'error') reset();
            }}
            onBlur={() => setTouched(true)}
            placeholder="Enter URL to analyze (e.g., https://example.com)"
            className="py-3 font-mono text-[13px]"
            error={touched ? validationError : null}
            trailing={
              url && !running ? (
                <button
                  type="button"
                  onClick={() => {
                    setUrl('');
                    setTouched(false);
                    reset();
                  }}
                  className="rounded p-1 text-slate-500 hover:text-slate-200"
                  aria-label="Clear URL"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
          />
        </div>
        <Button type="submit" disabled={running || (touched && Boolean(validationError))} className="py-3 sm:px-6">
          <Search className="h-4 w-4" aria-hidden="true" />
          {running ? 'Analyzing...' : 'Analyze URL'}
        </Button>
      </form>

      {showExamples && status === 'idle' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Try an example:</span>
          {EXAMPLE_URLS.map((example) => (
            <button
              key={example.url}
              type="button"
              onClick={() => tryExample(example.url)}
              className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              title={example.url}
            >
              {example.label}
            </button>
          ))}
        </div>
      )}

      {(running || status === 'done' || (status === 'error' && stage >= 0)) && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="relative mb-2 h-0.5 overflow-hidden rounded bg-slate-800" aria-hidden="true">
            {running && <div className="animate-scan-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />}
          </div>
          <ScanProgress stage={stage} status={status} />
        </div>
      )}

      {status === 'error' && error && error.code !== 'validation_error' && (
        <div className="mt-4">
          <Notice tone="danger" icon={AlertCircle}>
            <p className="font-medium">Analysis failed</p>
            <p className="mt-0.5 text-red-200/80">{error.message}</p>
          </Notice>
        </div>
      )}
      {status === 'error' && error?.code === 'validation_error' && !touched && (
        <p className="mt-2 text-sm text-red-400">{error.message}</p>
      )}
    </div>
  );
}
