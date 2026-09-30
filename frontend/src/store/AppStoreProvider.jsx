import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_API_BASE_URL, DEFAULT_API_MODE } from '../api/axiosClient';
import { demoAnalyze } from '../lib/demoEngine';
import { createEntry } from '../lib/ledger';
import { normalizeAnalysis } from '../lib/normalize';
import { SAMPLE_URLS } from '../lib/sampleData';
import { KEYS, readJson, writeJson } from '../lib/storage';
import { AppStoreContext } from './appStoreContext';

const MAX_HISTORY = 1000;

const DEFAULT_SETTINGS = {
  mode: DEFAULT_API_MODE,
  apiBaseUrl: DEFAULT_API_BASE_URL,
};

// Global client state: scan history, the tamper-evident audit chain and
// user settings, persisted to localStorage. `initialState` lets tests
// start from a known state without touching real storage.
export default function AppStoreProvider({ children, initialState }) {
  const [scans, setScans] = useState(() => initialState?.scans ?? readJson(KEYS.history, []));
  const [ledger, setLedger] = useState(() => initialState?.ledger ?? readJson(KEYS.ledger, []));
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(initialState?.settings ?? readJson(KEYS.settings, {})),
  }));
  const [tampered, setTampered] = useState(null);

  // Appends to the hash chain must be strictly sequential, even when several
  // scans finish at once (bulk scan), or two entries could share a prevHash.
  const ledgerRef = useRef(ledger);
  const chainQueue = useRef(Promise.resolve());

  useEffect(() => {
    ledgerRef.current = ledger;
  }, [ledger]);

  useEffect(() => {
    if (!initialState) writeJson(KEYS.history, scans);
  }, [scans, initialState]);
  useEffect(() => {
    if (!initialState) writeJson(KEYS.ledger, ledger);
  }, [ledger, initialState]);
  useEffect(() => {
    if (!initialState) writeJson(KEYS.settings, settings);
  }, [settings, initialState]);

  const appendToLedger = useCallback((scan) => {
    const task = chainQueue.current.then(async () => {
      const entry = await createEntry(ledgerRef.current, scan);
      ledgerRef.current = [...ledgerRef.current, entry];
      setLedger(ledgerRef.current);
      return entry;
    });
    chainQueue.current = task.catch(() => {});
    return task;
  }, []);

  const saveScan = useCallback(
    async (scan) => {
      const entry = await appendToLedger(scan);
      const saved = { ...scan, ledger: { index: entry.index, hash: entry.hash, prevHash: entry.prevHash } };
      setScans((current) => [saved, ...current.filter((s) => s.id !== saved.id)].slice(0, MAX_HISTORY));
      return saved;
    },
    [appendToLedger],
  );

  // Deleting history never rewrites the audit chain — that is the point.
  const removeScans = useCallback((ids) => {
    const drop = new Set(ids);
    setScans((current) => current.filter((scan) => !drop.has(scan.id)));
  }, []);

  const clearHistory = useCallback(() => setScans([]), []);

  const resetAll = useCallback(() => {
    setScans([]);
    ledgerRef.current = [];
    setLedger([]);
    setTampered(null);
  }, []);

  const loadSampleData = useCallback(async () => {
    const now = Date.now();
    const span = 13 * 86400000;
    // Spread scans over the last 14 days, oldest first, so the chain order
    // matches time order. A fixed pseudo-random offset keeps charts varied.
    const timed = SAMPLE_URLS.map((url, i) => ({
      url,
      at: now - span + ((i * 7919) % 100) / 100 * span - (i % 5) * 3600000,
    }))
      .map((item) => ({ ...item, at: Math.min(item.at, now - 60000) }))
      .sort((a, b) => a.at - b.at);

    const saved = [];
    for (const { url, at } of timed) {
      const response = demoAnalyze(url);
      response.evidence.analyzed_at = new Date(at).toISOString();
      const scan = normalizeAnalysis(response, { source: 'sample', submittedUrl: url });
      const entry = await appendToLedger(scan);
      saved.push({ ...scan, ledger: { index: entry.index, hash: entry.hash, prevHash: entry.prevHash } });
    }
    setScans((current) =>
      [...saved.reverse(), ...current]
        .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))
        .slice(0, MAX_HISTORY),
    );
    return saved.length;
  }, [appendToLedger]);

  // Demo-only: silently edit one stored record (without re-hashing) so the
  // Audit page can show verification catching it.
  const tamperLedger = useCallback(() => {
    const current = ledgerRef.current;
    if (!current.length) return null;
    // Pick a threat record mid-chain so the demo shows valid records before
    // the break and untrusted ones after it.
    const middle = Math.floor(current.length / 2);
    const target =
      current.slice(middle).find((entry) => entry.verdict !== 'benign') ??
      current.find((entry) => entry.verdict !== 'benign') ??
      current[middle];
    const original = { ...target };
    const forged = { ...target, verdict: 'benign', riskScore: 3 };
    ledgerRef.current = current.map((entry) => (entry.index === target.index ? forged : entry));
    setLedger(ledgerRef.current);
    setTampered(original);
    return target.index;
  }, []);

  const restoreLedger = useCallback(() => {
    if (!tampered) return;
    ledgerRef.current = ledgerRef.current.map((entry) => (entry.index === tampered.index ? tampered : entry));
    setLedger(ledgerRef.current);
    setTampered(null);
  }, [tampered]);

  const updateSettings = useCallback((patch) => setSettings((current) => ({ ...current, ...patch })), []);

  const value = useMemo(
    () => ({
      scans,
      ledger,
      settings,
      tamperedIndex: tampered?.index ?? null,
      saveScan,
      removeScans,
      clearHistory,
      resetAll,
      loadSampleData,
      tamperLedger,
      restoreLedger,
      updateSettings,
      getScan: (id) => scans.find((scan) => scan.id === id) ?? null,
    }),
    [scans, ledger, settings, tampered, saveScan, removeScans, clearHistory, resetAll, loadSampleData, tamperLedger, restoreLedger, updateSettings],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
