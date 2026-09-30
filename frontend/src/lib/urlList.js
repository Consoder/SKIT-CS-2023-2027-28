import { normalizeUrl } from './validateUrl';

export const BULK_LIMIT = 50;

// Splits pasted text / an uploaded .txt or .csv into candidate URLs
// (first column of each line), skipping headers, comments and duplicates.
export function parseUrlList(text) {
  const seen = new Set();
  const items = [];
  for (const line of String(text).split(/\r?\n/)) {
    const cell = line.split(/[,;\t]/)[0]?.trim().replace(/^["']|["']$/g, '');
    if (!cell || /^url$/i.test(cell) || cell.startsWith('#')) continue;
    const key = normalizeUrl(cell).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(cell);
  }
  return items;
}
