import { demoAnalyze } from '../lib/demoEngine';
import axiosClient from './axiosClient';

// Analyzes one URL. Both paths resolve to the same response shape:
//   { url, verdict, risk_score, evidence }
// - live: POST {baseUrl}/analyze  (backend Sprint 3.4)
// - demo: in-browser engine (lib/demoEngine.js)
export async function analyzeUrl(url, { mode = 'demo', baseUrl, signal } = {}) {
  if (mode === 'live') {
    const response = await axiosClient.post('/analyze', { url }, { baseURL: baseUrl, signal });
    return response.data;
  }
  return demoAnalyze(url);
}

// GET /health — used by Settings and the connection badge.
export async function checkHealth({ baseUrl, signal } = {}) {
  const started = performance.now();
  const response = await axiosClient.get('/health', { baseURL: baseUrl, signal, timeout: 5000 });
  return { ...response.data, latencyMs: Math.round(performance.now() - started) };
}

// Fetches server-side scan history once the backend exposes it (Sprint 6.3).
export async function getUrlHistory({ baseUrl, signal } = {}) {
  const response = await axiosClient.get('/history', { baseURL: baseUrl, signal });
  return response.data;
}
