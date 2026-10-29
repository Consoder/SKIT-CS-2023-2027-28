export const DAY_MS = 24 * 60 * 60 * 1000;

// True when `timestamp` falls within the last `days` days.
// `days` of null/0 means "no limit". Unparseable dates never match a limit.
export function isWithinDays(timestamp, days, now = Date.now()) {
  if (!days) return true;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;
  return time >= now - days * DAY_MS;
}