import axiosClient from './axiosClient';

// Sends a URL to the backend for analysis (feature extraction, threat
// intelligence lookup, ML classification, risk scoring). Returns the
// analysis result once the /url/analyze endpoint is implemented.
export async function analyzeUrl(url) {
  const response = await axiosClient.post('/url/analyze', { url });
  return response.data;
}

// Fetches the list of previously analyzed URLs for the history/dashboard views.
export async function getUrlHistory() {
  const response = await axiosClient.get('/url/history');
  return response.data;
}
