/**
 * All HTTP calls go through this module (Axios instance → Express API).
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export async function getSummary() {
  const { data } = await api.get('/reports/summary');
  return data;
}

export async function getMonthlyBreakdown() {
  const { data } = await api.get('/reports/monthly');
  return data;
}

export async function getSessions(params) {
  const { data } = await api.get('/sessions', { params });
  return data;
}

export async function createSession(body) {
  const { data } = await api.post('/sessions', body);
  return data;
}

export async function importIcsFile(file, { from, to } = {}) {
  const form = new FormData();
  form.append('file', file);
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await axios.post('/api/import/ics', form, { params });
  return data;
}

export async function importIcsPaste(ics, { from, to } = {}) {
  const payload = { ics };
  if (from) payload.from = from;
  if (to) payload.to = to;
  const { data } = await api.post('/import/ics', payload);
  return data;
}

export async function updateSession(id, body) {
  const { data } = await api.put(`/sessions/${id}`, body);
  return data;
}

export async function deleteSession(id) {
  await api.delete(`/sessions/${id}`);
}

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

export async function getConfig() {
  const { data } = await api.get('/config');
  return data;
}

export async function saveConfig(cfg) {
  const { data } = await api.put('/config', cfg);
  return data;
}

export function getExportUrl(from, to) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return `/api/reports/export?${q.toString()}`;
}
