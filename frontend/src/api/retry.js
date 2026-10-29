// Small retry helper for idempotent (GET) backend calls. A flaky connection or
// a briefly overloaded server should not show the user an error straight away.

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Network failures, timeouts and transient server statuses are worth retrying.
// Cancelled requests and client errors (400, 401, 404, 422...) are not.
export function isRetryable(error) {
  if (error?.code === 'ERR_CANCELED') return false;
  if (error?.response) return RETRYABLE_STATUS.has(error.response.status);
  return Boolean(error?.request) || error?.code === 'ECONNABORTED';
}

// Exponential backoff: base, 2x base, 4x base... capped at `max` milliseconds.
export function backoffDelay(attempt, base = 300, max = 3000) {
  return Math.min(max, base * 2 ** attempt);
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs `task(attempt)` and retries up to `retries` extra times while
// `shouldRetry(error)` is true. `sleep` is injectable so tests run instantly.
export async function withRetry(task, { retries = 2, baseDelay = 300, shouldRetry = isRetryable, sleep = defaultSleep, signal } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await task(attempt);
    } catch (error) {
      if (attempt >= retries || signal?.aborted || !shouldRetry(error)) throw error;
      await sleep(backoffDelay(attempt, baseDelay));
      attempt += 1;
    }
  }
}