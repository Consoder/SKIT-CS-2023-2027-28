import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, createEntry, sha256Hex, verifyLedger } from './ledger';

const scan = (n, verdict = 'phishing') => ({
  id: `scan-${n}`,
  url: `http://site-${n}.example.com`,
  verdict,
  riskScore: 80 + n,
  scannedAt: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
});

async function buildChain(count) {
  const chain = [];
  for (let i = 0; i < count; i += 1) chain.push(await createEntry(chain, scan(i)));
  return chain;
}

describe('audit hash chain', () => {
  it('hashes with SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('links each entry to the previous hash', async () => {
    const chain = await buildChain(3);
    expect(chain[0].prevHash).toBe(GENESIS_HASH);
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[2].index).toBe(2);
  });

  it('verifies an untouched chain', async () => {
    const result = await verifyLedger(await buildChain(4));
    expect(result).toMatchObject({ valid: true, checked: 4, firstBrokenIndex: null });
  });

  it('detects an edited record', async () => {
    const chain = await buildChain(4);
    chain[1] = { ...chain[1], verdict: 'benign' };
    const result = await verifyLedger(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(1);
    expect(result.results[1].hashOk).toBe(false);
  });

  it('detects a deleted record', async () => {
    const chain = await buildChain(4);
    chain.splice(2, 1);
    const result = await verifyLedger(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenIndex).toBe(2);
  });

  it('ignores UI-only fields', async () => {
    const chain = await buildChain(2);
    chain[0] = { ...chain[0], note: 'anything' };
    expect((await verifyLedger(chain)).valid).toBe(true);
  });
});
