// Tamper-evident audit log, kept in the browser as a SHA-256 hash chain.
//
// Each entry commits to its own fields AND the previous entry's hash, so
// editing any past record breaks every hash after it — the same property the
// Solidity/Ganache contract (Sprint 6.4) will provide on-chain. When the
// backend starts returning `evidence.audit` receipts, the UI shows those
// alongside this local chain.

export const GENESIS_HASH = `0x${'0'.repeat(64)}`;

// Only these fields are hashed; UI-only keys never affect integrity.
const HASHED_FIELDS = ['index', 'timestamp', 'scanId', 'url', 'verdict', 'riskScore', 'prevHash'];

function canonical(entry) {
  return JSON.stringify(HASHED_FIELDS.map((field) => entry[field]));
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function createEntry(ledger, scan) {
  const previous = ledger.at(-1);
  const entry = {
    index: ledger.length,
    timestamp: scan.scannedAt,
    scanId: scan.id,
    url: scan.url,
    verdict: scan.verdict,
    riskScore: scan.riskScore,
    prevHash: previous ? previous.hash : GENESIS_HASH,
  };
  entry.hash = await sha256Hex(canonical(entry));
  return entry;
}

// Recomputes every hash. Returns { valid, checked, firstBrokenIndex, results[] }.
export async function verifyLedger(ledger) {
  const results = [];
  let firstBrokenIndex = null;
  for (let i = 0; i < ledger.length; i += 1) {
    const entry = ledger[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : ledger[i - 1].hash;
    const recomputed = await sha256Hex(canonical(entry));
    const hashOk = recomputed === entry.hash;
    const linkOk = entry.prevHash === expectedPrev && entry.index === i;
    const ok = hashOk && linkOk;
    if (!ok && firstBrokenIndex === null) firstBrokenIndex = i;
    results.push({ index: i, ok, hashOk, linkOk, recomputed });
  }
  return { valid: firstBrokenIndex === null, checked: ledger.length, firstBrokenIndex, results };
}

export function shortHash(hash, size = 8) {
  if (!hash) return '—';
  return `${hash.slice(0, size + 2)}…${hash.slice(-size)}`;
}
