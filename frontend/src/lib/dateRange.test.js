import { describe, expect, it } from 'vitest';
import { DAY_MS, isWithinDays } from './dateRange';

const NOW = new Date('2026-10-29T12:00:00Z').getTime();
const ago = (days) => new Date(NOW - days * DAY_MS).toISOString();

describe('isWithinDays', () => {
  it('has no limit when days is null or 0', () => {
    expect(isWithinDays(ago(400), null, NOW)).toBe(true);
    expect(isWithinDays(ago(400), 0, NOW)).toBe(true);
  });

  it('includes scans inside the window and excludes older ones', () => {
    expect(isWithinDays(ago(0.5), 1, NOW)).toBe(true);
    expect(isWithinDays(ago(2), 1, NOW)).toBe(false);
    expect(isWithinDays(ago(6.9), 7, NOW)).toBe(true);
    expect(isWithinDays(ago(8), 7, NOW)).toBe(false);
  });

  it('treats the exact cutoff as inside the window', () => {
    expect(isWithinDays(ago(7), 7, NOW)).toBe(true);
  });

  it('never matches an invalid date when a limit is set', () => {
    expect(isWithinDays('not a date', 7, NOW)).toBe(false);
    expect(isWithinDays(undefined, 30, NOW)).toBe(false);
  });

  it('accepts Date objects and epoch milliseconds', () => {
    expect(isWithinDays(new Date(NOW - DAY_MS), 7, NOW)).toBe(true);
    expect(isWithinDays(NOW - DAY_MS, 7, NOW)).toBe(true);
  });
});