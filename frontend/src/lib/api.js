import axios from 'axios';
import { getToken, clearToken } from './auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
export async function completeOnboarding() {
  const { data } = await api.post('/auth/complete-onboarding');
  return data;
}

// Clients
export async function getClients() {
  const { data } = await api.get('/clients');
  return data;
}
export async function getClient(id) {
  const { data } = await api.get(`/clients/${id}`);
  return data;
}
export async function createClient(body) {
  const { data } = await api.post('/clients', body);
  return data;
}
export async function updateClient(id, body) {
  const { data } = await api.put(`/clients/${id}`, body);
  return data;
}
export async function deleteClient(id) {
  await api.delete(`/clients/${id}`);
}
export async function setDefaultClient(id) {
  const { data } = await api.post(`/clients/${id}/default`);
  return data;
}

// Reports
export async function getSummary(clientId) {
  const params = clientId ? { clientId } : {};
  const { data } = await api.get('/reports/summary', { params });
  return data;
}
export async function getMonthlyBreakdown(clientId) {
  const params = clientId ? { clientId } : {};
  const { data } = await api.get('/reports/monthly', { params });
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
export async function deleteUncategorizedSessions(clientId) {
  const params = clientId ? { clientId } : {};
  const { data } = await api.delete('/sessions/uncategorized', { params });
  return data;
}

// Payments
export async function getPayments(clientId) {
  const params = clientId ? { clientId } : {};
  const { data } = await api.get('/payments', { params });
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

// ICS smart import (preview + confirm)
export async function previewIcsFile(file, { from, to, clientId, delimiter } = {}) {
  const form = new FormData();
  form.append('file', file);
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (clientId) params.clientId = clientId;
  if (delimiter) params.delimiter = delimiter;
  const { data } = await axios.post('/api/import/ics/preview', form, {
    params,
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return data;
}
export async function previewIcsPaste(ics, { from, to, clientId, delimiter } = {}) {
  const payload = { ics };
  if (from) payload.from = from;
  if (to) payload.to = to;
  if (clientId) payload.clientId = clientId;
  if (delimiter) payload.delimiter = delimiter;
  const { data } = await api.post('/import/ics/preview', payload);
  return data;
}
export async function confirmIcsImport({ ics, clientId, from, to, delimiter, mappings, skippedTitles }) {
  const { data } = await api.post('/import/ics/confirm', {
    ics,
    clientId,
    from,
    to,
    delimiter,
    mappings,
    skippedTitles,
  });
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

// Alerts
export async function getAlertSettings() {
  const { data } = await api.get('/alerts/settings');
  return data;
}
export async function saveAlertSettings(body) {
  const { data } = await api.put('/alerts/settings', body);
  return data;
}
export async function sendTestAlert() {
  const { data } = await api.post('/alerts/test');
  return data;
}

// Admin
export async function resetData({ scope = 'all' } = {}) {
  const { data } = await api.post('/admin/reset', { confirm: 'RESET', scope });
  return data;
}

export async function getOverdueNotifications(clientId) {
  const params = clientId ? { clientId } : {};
  const { data } = await api.get('/notifications/overdue', { params });
  return data;
}

// Billing
export async function getBillingStatus() {
  const { data } = await api.get('/billing/status');
  return data;
}
export async function createCheckout(billingCycle = 'monthly') {
  const { data } = await api.post('/billing/checkout', { billingCycle });
  return data;
}
export async function createBillingPortal() {
  const { data } = await api.post('/billing/portal');
  return data;
}

// Export helpers
export async function downloadExcel(clientId, from, to) {
  const params = {};
  if (clientId) params.clientId = clientId;
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await api.get('/reports/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `salary_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadDemandLetter(clientId) {
  const params = {};
  if (clientId) params.clientId = clientId;
  const response = await api.get('/reports/demand-letter', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `demand_letter_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoice(salaryMonth, clientId) {
  const params = { month: salaryMonth };
  if (clientId) params.clientId = clientId;
  const response = await api.get('/reports/invoice', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice_${salaryMonth.replace(/\s/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
