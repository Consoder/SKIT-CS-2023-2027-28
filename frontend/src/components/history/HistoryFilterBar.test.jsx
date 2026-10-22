import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HistoryFilterBar, { DATE_RANGES, filterScans, VERDICT_OPTIONS } from './HistoryFilterBar';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

// Stored scans use lowercase verdicts (see lib/normalize.js).
const SCANS = [
  { id: '1', url: 'https://example.com', verdict: 'benign', scannedAt: ago(0.1) },
  { id: '2', url: 'http://paypa1-login.xyz/verify', verdict: 'phishing', scannedAt: ago(2) },
  { id: '3', url: 'http://free-download.top/setup.exe', verdict: 'malware', scannedAt: ago(10) },
  { id: '4', url: 'http://bit.ly/abc123', verdict: 'suspicious', scannedAt: ago(40) },
];

const NO_FILTERS = { query: '', verdict: 'All', days: null };

describe('filterScans', () => {
  it('returns everything when no filter is set', () => {
    expect(filterScans(SCANS, NO_FILTERS)).toHaveLength(4);
  });

  it('matches the search text case-insensitively and ignores surrounding spaces', () => {
    const result = filterScans(SCANS, { ...NO_FILTERS, query: '  PAYPA1 ' });
    expect(result.map((s) => s.id)).toEqual(['2']);
  });

  it('filters by verdict even though options are capitalised and stored verdicts are lowercase', () => {
    const result = filterScans(SCANS, { ...NO_FILTERS, verdict: 'Phishing' });
    expect(result.map((s) => s.id)).toEqual(['2']);
  });

  it('filters by date range', () => {
    expect(filterScans(SCANS, { ...NO_FILTERS, days: 1 }).map((s) => s.id)).toEqual(['1']);
    expect(filterScans(SCANS, { ...NO_FILTERS, days: 7 }).map((s) => s.id)).toEqual(['1', '2']);
    expect(filterScans(SCANS, { ...NO_FILTERS, days: 30 }).map((s) => s.id)).toEqual(['1', '2', '3']);
  });

  it('combines text, verdict and date filters with AND', () => {
    const result = filterScans(SCANS, { query: 'http', verdict: 'Malware', days: 30 });
    expect(result.map((s) => s.id)).toEqual(['3']);
    expect(filterScans(SCANS, { query: 'example', verdict: 'Malware', days: null })).toEqual([]);
  });

  it('does not mutate the input list', () => {
    const copy = [...SCANS];
    filterScans(SCANS, { ...NO_FILTERS, query: 'zzz' });
    expect(SCANS).toEqual(copy);
  });
});

describe('filter options', () => {
  it('offers All plus the four model classes', () => {
    expect(VERDICT_OPTIONS).toEqual(['All', 'Benign', 'Phishing', 'Malware', 'Suspicious']);
  });

  it('starts with an unlimited date range', () => {
    expect(DATE_RANGES[0]).toEqual({ label: 'All time', days: null });
  });
});

describe('HistoryFilterBar', () => {
  const setup = (filters = NO_FILTERS, props = {}) => {
    const onChange = vi.fn();
    render(<HistoryFilterBar filters={filters} onChange={onChange} total={4} shown={4} {...props} />);
    return onChange;
  };

  it('shows how many scans match', () => {
    setup(NO_FILTERS, { shown: 2 });
    expect(screen.getByText(/showing 2 of 4 scans/i)).toBeInTheDocument();
  });

  it('reports typed search text through onChange', () => {
    const onChange = setup();
    fireEvent.change(screen.getByPlaceholderText(/search by url/i), { target: { value: 'paypa1' } });
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, query: 'paypa1' });
  });

  it('reports a verdict change through onChange', () => {
    const onChange = setup();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Phishing' } });
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, verdict: 'Phishing' });
  });

  it('reports a date range as a number of days', () => {
    const onChange = setup();
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, days: 7 });
  });

  it('hides Clear until a filter is active, then resets everything', () => {
    const { unmount } = render(<HistoryFilterBar filters={NO_FILTERS} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    unmount();

    const onChange = setup({ query: 'abc', verdict: 'Malware', days: 7 });
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(NO_FILTERS);
  });
});
