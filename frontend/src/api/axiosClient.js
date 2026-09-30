import axios from 'axios';

// Central axios instance for all backend calls. The FastAPI app mounts every
// route under API_V1_PREFIX ("/api/v1", backend/app/core/config.py).
// Override at build time with VITE_API_BASE_URL, or at runtime from
// Settings → Backend connection (per-request `baseURL`).
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// "demo" runs the in-browser engine; "live" calls the FastAPI backend.
export const DEFAULT_API_MODE = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'demo';

const axiosClient = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosClient;
