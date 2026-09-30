// Thin localStorage wrapper. Scan history and the audit chain live in the
// browser until the backend's /history + PostgreSQL work lands (Sprint 6.3).
// Every access is guarded: private windows or blocked storage must never
// break the app, it just stops persisting.

const PREFIX = 'urlshield.';

export const KEYS = {
  history: `${PREFIX}history.v1`,
  ledger: `${PREFIX}ledger.v1`,
  settings: `${PREFIX}settings.v1`,
};

export function readJson(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}
