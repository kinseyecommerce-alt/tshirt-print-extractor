// ============================================================
// Axios API client. Uses relative URLs so it works both in dev (Vite proxy)
// and in production (served from the same origin as the API).
// ============================================================
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Surface a clean error message from the server's { error } payload.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error || err.message || 'Something went wrong.';
    return Promise.reject(new Error(message));
  }
);

export default api;

// --- Auth -------------------------------------------------------------------
export const login = (username, password) =>
  api.post('/login', { username, password }).then((r) => r.data);
export const logout = () => api.post('/logout').then((r) => r.data);
export const me = () => api.get('/me').then((r) => r.data);

// --- Uploads ----------------------------------------------------------------
export const uploadSingle = (formData) =>
  api.post('/upload/single', formData).then((r) => r.data);
export const uploadBulk = (formData) =>
  api.post('/upload/bulk', formData).then((r) => r.data);
export const uploadZip = (formData) =>
  api.post('/upload/zip', formData).then((r) => r.data);

// --- URLs -------------------------------------------------------------------
export const previewUrl = (url) =>
  api.post('/url/preview', { url }).then((r) => r.data);
export const submitSingleUrl = (payload) =>
  api.post('/url/single', payload).then((r) => r.data);
export const submitBulkUrls = (payload) =>
  api.post('/url/bulk', payload).then((r) => r.data);
export const submitCsvUrls = (formData) =>
  api.post('/url/csv', formData).then((r) => r.data);

// --- Jobs -------------------------------------------------------------------
export const fetchJobs = (batchId) =>
  api.get('/jobs', { params: batchId ? { batchId } : {} }).then((r) => r.data);
export const fetchJob = (id) => api.get(`/jobs/${id}`).then((r) => r.data);
export const retryJob = (id) => api.post(`/jobs/${id}/retry`).then((r) => r.data);
export const reprocessJob = (id, payload) =>
  api.post(`/jobs/${id}/reprocess`, payload).then((r) => r.data);
export const sourceUrl = (id) => `/api/jobs/${id}/source`;

// --- Download links ---------------------------------------------------------
export const downloadUrl = (filename) => `/api/download/${encodeURIComponent(filename)}`;
export const zipUrl = (batchId) => `/api/download-zip/${encodeURIComponent(batchId)}`;
export const reportUrl = (batchId) => `/api/report/${encodeURIComponent(batchId)}`;
export const fileUrl = (filename) => `/files/outputs/${encodeURIComponent(filename)}`;
