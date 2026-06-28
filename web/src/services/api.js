// ── API Service ────────────────────────────────────────────
const BASE = process.env.REACT_APP_API_URL || 'https://hellocoolie.onrender.com/api';

const api = {
  getToken: () => localStorage.getItem('hc_token'),
  setToken: (t) => localStorage.setItem('hc_token', t),
  setSession: (d) => localStorage.setItem('hc_session', JSON.stringify(d)),
  getSession: () => { try { return JSON.parse(localStorage.getItem('hc_session')); } catch { return null; } },
  clear: () => { localStorage.removeItem('hc_token'); localStorage.removeItem('hc_session'); },

  async req(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json', 'x-platform': 'web' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(`${BASE}${path}`, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Auth
  loginAdmin:  (email, password) => api.req('POST', '/auth/admin/login',  { email, password }),
  loginViewer: (email, password) => api.req('POST', '/auth/viewer/login', { email, password }),

  // Admin stats
  getStats:         () => api.req('GET', '/admin/stats'),
  getStations:      () => api.req('GET', '/admin/stations'),
  getAllBookings:    (params = '') => api.req('GET', `/admin/bookings${params}`),

  // Porter management
  getPorters:       (params = '') => api.req('GET', `/admin/porters${params}`),
  approvePorter:    (id) => api.req('PATCH', `/admin/porters/${id}/approve`),
  suspendPorter:    (id, reason) => api.req('PATCH', `/admin/porters/${id}/suspend`, { reason }),
  reactivatePorter: (id) => api.req('PATCH', `/admin/porters/${id}/reactivate`),
  getPorterEarnings:(id) => api.req('GET', `/admin/porters/${id}/earnings`),

  // User management
  getUsers:    (params = '') => api.req('GET', `/admin/users${params}`),
  banUser:     (id) => api.req('PATCH', `/admin/users/${id}/ban`),
  unbanUser:   (id) => api.req('PATCH', `/admin/users/${id}/unban`),

  // Fraud
  getFraudFlags:   () => api.req('GET', '/admin/fraud-flags'),
  reviewFraudFlag: (id, action) => api.req('PATCH', `/admin/fraud-flags/${id}/review`, { action_taken: action }),

  // Surge pricing
  getSurgeConfigs: () => api.req('GET', '/admin/surge'),
  createSurge:     (data) => api.req('POST', '/admin/surge', data),

  // Viewer management
  createViewer:    (data) => api.req('POST', '/admin/viewers', data),

  // Offline fees
  getOfflineFees:  () => api.req('GET', '/admin/offline-fees-pending'),

  // Viewer routes
  getBookingById:  (id) => api.req('GET', `/viewer/bookings/${id}`),
  getDisputes:     (status = 'open') => api.req('GET', `/viewer/disputes?status=${status}`),
  getMyDisputes:   () => api.req('GET', '/viewer/disputes/my-assignments'),
  resolveDispute:  (id, data) => api.req('PATCH', `/viewer/disputes/${id}/resolve`, data),
  getStalledBookings: () => api.req('GET', '/viewer/stalled-bookings'),
  tempSuspendPorter:  (id, reason) => api.req('PATCH', `/viewer/porters/${id}/temp-suspend`, { reason }),
  cancelStalledBooking: (id) => api.req('PATCH', `/viewer/bookings/${id}/cancel`),
  getActiveSOS:    () => api.req('GET', '/viewer/sos/active'),
  resolveSOS:      (id) => api.req('PATCH', `/viewer/sos/${id}/resolve`),

  // i18n
  getStrings:      (lang) => api.req('GET', `/i18n/strings?lang=${lang}`),
  upsertString:    (data) => api.req('POST', '/admin/strings', data),
};

export default api;
