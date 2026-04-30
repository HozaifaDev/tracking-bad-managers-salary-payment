import axios from 'axios';
import { getToken, clearToken } from './auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Auth
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function register(email, password, name) {
  const { data } = await api.post('/auth/register', { email, password, name });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Reports
export async function getSummary() {
  const { data } = await api.get('/reports/summary');
  return data;
}

export async function getMonthlyBreakdown() {
  const { data } = await api.get('/reports/monthly');
  return data;
}

// Sessions
export async function getSessions(params) {
  const { data } = await api.get('/sessions', { params });
  return data;
}

export async function createSession(body) {
  const { data } = await api.post('/sessions', body);
  return data;
}

export async function updateSession(id, body) {
  const { data } = await api.put(`/sessions/${id}`, body);
  return data;
}

export async function deleteSession(id) {
  await api.delete(`/sessions/${id}`);
}

// Payments
export async function getPayments() {
  const { data } = await api.get('/payments');
  return data;
}

export async function createPayment(body) {
  const { data } = await api.post('/payments', body);
  return data;
}

export async function updatePayment(id, body) {
  const { data } = await api.put(`/payments/${id}`, body);
  return data;
}

export async function deletePayment(id) {
  await api.delete(`/payments/${id}`);
}

// Calendar / Sync
export async function syncCalendar(body) {
  const { data } = await api.post('/calendar/sync', body);
  return data;
}

export async function getCalendarStatus() {
  const { data } = await api.get('/calendar/status');
  return data;
}

export async function getSyncLog() {
  const { data } = await api.get('/sync/log');
  return data;
}

// ICS import
export async function importIcsFile(file, { from, to } = {}) {
  const form = new FormData();
  form.append('file', file);
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await axios.post('/api/import/ics', form, {
    params,
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return data;
}

export async function importIcsPaste(ics, { from, to } = {}) {
  const payload = { ics };
  if (from) payload.from = from;
  if (to) payload.to = to;
  const { data } = await api.post('/import/ics', payload);
  return data;
}

// Config
export async function getConfig() {
  const { data } = await api.get('/config');
  return data;
}

export async function saveConfig(cfg) {
  const { data } = await api.put('/config', cfg);
  return data;
}

// Admin
export async function resetData({ scope = 'all' } = {}) {
  const { data } = await api.post('/admin/reset', { confirm: 'RESET', scope });
  return data;
}

// Export URL helper (browser download)
export function getExportUrl(from, to) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return `/api/reports/export?${q.toString()}`;
}
