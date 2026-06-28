import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

// ── SIDEBAR ────────────────────────────────────────────────
export function Sidebar({ activePage, onNavigate, alerts = {} }) {
  const { user, logout } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const adminNav = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
    { id: 'stations',   icon: '🚉', label: 'Stations' },
    { id: 'bookings',   icon: '📋', label: 'All Bookings' },
    { id: 'porters',    icon: '🔴', label: 'Porter Management', badge: alerts.pendingPorters },
    { id: 'users',      icon: '👤', label: 'Passenger Management' },
    { id: 'fraud',      icon: '🚨', label: 'Fraud Alerts', badge: alerts.fraudFlags },
    { id: 'disputes',   icon: '⚖️',  label: 'Disputes', badge: alerts.openDisputes },
    { id: 'sos',        icon: '🆘', label: 'SOS Alerts', badge: alerts.activeSOS },
    { id: 'surge',      icon: '💹', label: 'Surge Pricing' },
    { id: 'offline',    icon: '💵', label: 'Offline Fee Recovery' },
    { id: 'viewers',    icon: '👁️',  label: 'Viewer Accounts' },
    { id: 'i18n',       icon: '🌐', label: 'App Strings (i18n)' },
  ];

  const viewerNav = [
    { id: 'search',     icon: '🔍', label: 'Search Booking' },
    { id: 'disputes',   icon: '⚖️',  label: 'My Disputes', badge: alerts.myDisputes },
    { id: 'stalled',    icon: '⏳', label: 'Stalled Bookings' },
    { id: 'sos',        icon: '🆘', label: 'SOS Alerts', badge: alerts.activeSOS },
  ];

  const nav = isAdmin ? adminNav : viewerNav;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="HelloCoolie" style={{ height: 40 }} />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {isAdmin ? 'Admin Portal' : 'Viewer Portal'}
        </div>
        {nav.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {!!item.badge && item.badge > 0 && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={logout}>
          <div className="avatar avatar-orange">
            {user?.name?.[0] || 'A'}
          </div>
          <div>
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">
              {isAdmin ? '👑 Admin' : '👁️ Viewer'} · Sign out
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── TOPBAR ─────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      <div className="topbar-right">
        {actions}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" />
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Live</span>
        </div>
      </div>
    </div>
  );
}

// ── STAT CARD ──────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color = 'orange' }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── DATA TABLE ─────────────────────────────────────────────
export function DataTable({ title, columns, rows, actions, loading, emptyMsg = 'No data found', searchable = true }) {
  const [q, setQ] = useState('');
  const filtered = q
    ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q.toLowerCase())))
    : rows;

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div className="table-title">
          {title}
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 400 }}>
            ({filtered.length} records)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {searchable && (
            <div className="search-wrap">
              <input
                placeholder="Search..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
          )}
          {actions}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--gray-400)' }}>
          <div className="spinner spinner-orange" style={{ margin: '0 auto 12px' }} />
          <div>Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h4>{emptyMsg}</h4>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── MODAL ──────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h4>{title}</h4>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── BADGE helpers ──────────────────────────────────────────
export const statusBadge = (status) => {
  const map = {
    pending:           ['badge-amber',  '⏳ Pending'],
    accepted:          ['badge-blue',   '✓ Accepted'],
    in_progress:       ['badge-blue',   '▶ In Progress'],
    completed:         ['badge-green',  '✅ Completed'],
    cancelled_by_user: ['badge-gray',   '✕ User Cancelled'],
    cancelled_by_porter:['badge-red',   '✕ Porter Cancelled'],
    expired:           ['badge-gray',   '⌛ Expired'],
    disputed:          ['badge-red',    '⚠️ Disputed'],
    approved:          ['badge-green',  '✓ Approved'],
    suspended:         ['badge-red',    '⊘ Suspended'],
    reactivated:       ['badge-blue',   '↺ Reactivated'],
    active:            ['badge-green',  '● Active'],
    inactive:          ['badge-gray',   '○ Inactive'],
    open:              ['badge-amber',  '⚠️ Open'],
    resolved:          ['badge-green',  '✓ Resolved'],
    online:            ['badge-green',  '● Online'],
    offline:           ['badge-gray',   '○ Offline'],
    paid:              ['badge-green',  '✓ Paid'],
    cash:              ['badge-amber',  '💵 Cash'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return <span className={`badge ${cls}`}>{label}</span>;
};

// ── FORMAT UTILS ──────────────────────────────────────────
export const fmt = {
  currency: (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`,
  date: (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
  datetime: (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
  phone: (p) => p ? `+91 ${p}` : '—',
};

// ── CONFIRM DIALOG ─────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState({ open: false, msg: '', resolve: null });
  const confirm = (msg) => new Promise(resolve => setState({ open: true, msg, resolve }));
  const Dialog = () => !state.open ? null : (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 28 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
          <h4 style={{ marginBottom: 8 }}>Are you sure?</h4>
          <p style={{ marginBottom: 24 }}>{state.msg}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={() => { state.resolve(false); setState({ open: false }); }}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { state.resolve(true); setState({ open: false }); }}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
  return { confirm, Dialog };
}

// ── TOAST ─────────────────────────────────────────────────
let toastTimeout;
export function toast(msg, type = 'success') {
  const existing = document.getElementById('hc-toast');
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);
  const t = document.createElement('div');
  t.id = 'hc-toast';
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--blue)', warn: 'var(--amber)' };
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]||colors.success};color:white;padding:12px 20px;border-radius:12px;font-weight:600;font-size:0.875rem;z-index:9999;box-shadow:var(--shadow-lg);max-width:320px;animation:slideUp 0.25s ease;font-family:var(--font-body)`;
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimeout = setTimeout(() => t.remove(), 3500);
}
