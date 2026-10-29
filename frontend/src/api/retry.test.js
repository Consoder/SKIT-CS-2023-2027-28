import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, isRetryable, withRetry } from './retry';

const httpError = (status) => ({ response: { status } });
const networkError = () => ({ request: {}, message: 'Network Error' });
const noSleep = () => Promise.resolve();

describe('isRetryable', () => {
  it('retries network failures and timeouts', () => {
    expect(isRetryable(networkError())).toBe(true);
    expect(isRetryable({ code: 'ECONNABORTED' })).toBe(true);
  });

  it('retries transient server statuses only', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) expect(isRetryable(httpError(status))).toBe(true);
    for (const status of [400, 401, 403, 404, 422]) expect(isRetryable(httpError(status))).toBe(false);
  });

  it('never retries a cancelled request', () => {
    expect(isRetryable({ code: 'ERR_CANCELED', request: {} })).toBe(false);
  });

  it('does not retry plain programming errors', () => {
    expect(isRetryable(new Error('boom'))).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('doubles each attempt and respects the cap', () => {
    expect(backoffDelay(0, 300)).toBe(300);
    expect(backoffDelay(1, 300)).toBe(600);
    expect(backoffDelay(2, 300)).toBe(1200);
    expect(backoffDelay(10, 300, 3000)).toBe(3000);
  });
});

describe('withRetry', () => {
  it('returns the result without retrying on success', async () => {
    const task = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(task, { sleep: noSleep })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and then succeeds', async () => {
    const task = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValue('ok');
    await expect(withRetry(task, { sleep: noSleep })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('passes the attempt number to the task', async () => {
    const task = vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValue('ok');
    await withRetry(task, { sleep: noSleep });
    expect(task.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1]);
  });

  it('gives up after the configured number of retries and throws the last error', async () => {
    const error = httpError(500);
    const task = vi.fn().mockRejectedValue(error);
    await expect(withRetry(task, { retries: 2, sleep: noSleep })).rejects.toBe(error);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable error', async () => {
    const task = vi.fn().mockRejectedValue(httpError(404));
    await expect(withRetry(task, { sleep: noSleep })).rejects.toEqual(httpError(404));
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('waits with growing delays between attempts', async () => {
    const sleep = vi.fn().mockResolvedValue();
    const task = vi.fn().mockRejectedValue(networkError());
    await expect(withRetry(task, { retries: 2, baseDelay: 100, sleep })).rejects.toBeDefined();
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('stops retrying once the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn().mockRejectedValue(networkError());
    await expect(withRetry(task, { signal: controller.signal, sleep: noSleep })).rejects.toBeDefined();
    expect(task).toHaveBeenCalledTimes(1);
  });
});