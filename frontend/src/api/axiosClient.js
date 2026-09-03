import axios from 'axios';

// Central axios instance for all backend calls. The FastAPI backend's base
// URL can be overridden via a Vite env variable (VITE_API_BASE_URL) once
// deployment details are finalized.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosClient;
