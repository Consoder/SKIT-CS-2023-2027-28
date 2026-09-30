export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function formatAge(days) {
  if (days === null || days === undefined) return '—';
  if (days < 1) return 'Less than a day';
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function truncateMiddle(text, max = 60) {
  if (!text || text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(-half)}`;
}

// Local-day key (YYYY-MM-DD) for bucketing scans by day.
export function dayKey(value) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
