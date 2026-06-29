import React, { useState, useEffect } from 'react';
import './index.css';
import { AuthProvider, useAuth, useData } from './hooks/useAuth';
import { Sidebar, Topbar, toast } from './components/shared';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import PortersPage from './pages/admin/PortersPage';
import {
  UsersPage, BookingsPage, DisputesPage, SOSPage,
  SurgePage, FraudPage, SearchPage
} from './pages/admin/AllPages';
import api from './services/api';

// ── Page titles ────────────────────────────────────────────
const PAGE_META = {
  dashboard:  { title: 'Dashboard',          sub: 'Platform overview' },
  stations:   { title: 'Stations',            sub: 'Station-wise analytics' },
  bookings:   { title: 'All Bookings',        sub: 'Booking management' },
  porters:    { title: 'Porter Management',   sub: 'Approve, suspend, view earnings' },
  users:      { title: 'Passengers',          sub: 'User account management' },
  fraud:      { title: 'Fraud Alerts',        sub: 'Suspicious activity flags' },
  disputes:   { title: 'Disputes',            sub: 'Investigate and resolve' },
  sos:        { title: 'SOS Alerts',          sub: 'Emergency alerts — respond immediately' },
  surge:      { title: 'Surge Pricing',       sub: 'Festival and seasonal pricing' },
  offline:    { title: 'Offline Fee Recovery',sub: 'Pending platform fee collection' },
  viewers:    { title: 'Viewer Accounts',     sub: 'Create and manage viewer access' },
  i18n:       { title: 'App Strings',         sub: 'Hindi & English localization' },
  search:     { title: 'Search Booking',      sub: 'Find any booking by ID' },
  stalled:    { title: 'Stalled Bookings',    sub: 'Bookings with no porter response' },
};

// ── Offline fees page ──────────────────────────────────────
function OfflineFeesPage() {
  const { data, loading } = useData(api.getOfflineFees);
  const fees = data?.pending || [];
  return (
    <div className="animate-fade">
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        💵 These bookings used cash payment. Platform fee (15–25%) needs to be recovered from porter wallets.
      </div>
      <div className="table-wrap">
        <div className="table-toolbar"><div className="table-title">Pending Offline Fee Recovery</div></div>
        <table>
          <thead><tr><th>Booking ID</th><th>Porter</th><th>Station</th><th>Platform Fee Due</th><th>Porter Wallet</th><th>Completed</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{textAlign:'center',padding:32}}>Loading...</td></tr>}
            {!loading && fees.length === 0 && <tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--gray-400)'}}>✅ All offline fees recovered!</td></tr>}
            {fees.map((f,i) => (
              <tr key={i}>
                <td><code style={{fontSize:'0.75rem'}}>{f.id}</code></td>
                <td><div style={{fontWeight:600}}>{f.porter_name}</div><div style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{f.porter_phone}</div></td>
                <td>{f.arrival_station}</td>
                <td style={{fontWeight:700,color:'var(--red)'}}>₹{f.platform_fee}</td>
                <td style={{fontWeight:700,color:parseFloat(f.wallet_balance)>=parseFloat(f.platform_fee)?'var(--green)':'var(--red)'}}>₹{f.wallet_balance}</td>
                <td style={{fontSize:'0.78rem'}}>{f.completed_at ? new Date(f.completed_at).toLocaleString('en-IN') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Create Viewer page ─────────────────────────────────────
function ViewersPage() {
  const [form, setForm] = useState({ name:'', email:'', pan_no:'', date_of_birth:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [tab, setTab] = useState('list');

  useEffect(() => { loadViewers(); }, []);

  const loadViewers = async () => {
    const r = await api.get('/admin/viewers');
    if (r.ok) setViewers(r.viewers || []);
  };

  const handleCreate = async () => {
    if (!form.name||!form.email||!form.pan_no||!form.date_of_birth||!form.password) { toast('Fill all fields','warn'); return; }
    setLoading(true);
    const r = await api.createViewer(form);
    setLoading(false);
    if (r.ok) {
      toast('✅ Viewer account created!');
      setForm({ name:'',email:'',pan_no:'',date_of_birth:'',password:'' });
      loadViewers();
      setTab('list');
    } else toast(r.error,'error');
  };

  const toggleStatus = async (id, current) => {
    const r = await api.patch(`/admin/viewers/${id}/status`, { is_active: !current });
    if (r.ok) { toast(r.message); loadViewers(); }
    else toast(r.error,'error');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete viewer "${name}"? Cannot be undone.`)) return;
    const r = await api.del(`/admin/viewers/${id}`);
    if (r.ok) { toast('✅ Viewer deleted'); loadViewers(); }
    else toast(r.error,'error');
  };

  return (
    <div className="animate-fade">
      {/* Tabs */}
      <div className="d-flex gap-2 mb-4">
        <button onClick={()=>setTab('list')} className={`btn btn-sm ${tab==='list'?'btn-primary':'btn-outline-secondary'}`}>
          👥 All Viewers ({viewers.length})
        </button>
        <button onClick={()=>setTab('create')} className={`btn btn-sm ${tab==='create'?'btn-primary':'btn-outline-secondary'}`}>
          ➕ Create Viewer
        </button>
      </div>

      {/* LIST TAB */}
      {tab === 'list' && (
        <div className="card">
          <div className="card-header"><h4>Viewer Accounts</h4></div>
          <div className="card-body p-0">
            {viewers.length === 0 ? (
              <div className="text-center text-muted py-5">
                <div style={{fontSize:48}}>👁️</div>
                <p>No viewer accounts yet.</p>
                <button className="btn btn-primary btn-sm" onClick={()=>setTab('create')}>Create First Viewer</button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Open Disputes</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewers.map(v => (
                      <tr key={v.id}>
                        <td><strong>{v.name}</strong></td>
                        <td>{v.email}</td>
                        <td><span className="badge bg-warning text-dark">{v.open_disputes||0}</span></td>
                        <td>{new Date(v.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`badge ${v.is_active?'bg-success':'bg-secondary'}`}>
                            {v.is_active?'✅ Active':'⏸ Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <button
                              onClick={()=>toggleStatus(v.id, v.is_active)}
                              className={`btn btn-sm ${v.is_active?'btn-outline-warning':'btn-outline-success'}`}>
                              {v.is_active?'Deactivate':'Activate'}
                            </button>
                            <button
                              onClick={()=>handleDelete(v.id, v.name)}
                              className="btn btn-sm btn-outline-danger">
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE TAB */}
      {tab === 'create' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-header"><h4>Create Viewer Account</h4></div>
          <div className="card-body">
            <div className="alert alert-info mb-4">
              Viewer accounts can search bookings, investigate disputes, and handle SOS alerts. They cannot access financial data or permanently suspend accounts.
            </div>
            {[
              { label:'Full Name', key:'name', type:'text', placeholder:'Viewer full name' },
              { label:'Email Address', key:'email', type:'email', placeholder:'viewer@hellocoolie.in' },
              { label:'PAN Number (for password reset)', key:'pan_no', type:'text', placeholder:'ABCDE1234F' },
              { label:'Date of Birth (for password reset)', key:'date_of_birth', type:'date' },
              { label:'Initial Password', key:'password', type:'password', placeholder:'Min 8 characters' },
            ].map(f => (
              <div className="mb-3" key={f.key}>
                <label className="form-label fw-semibold">{f.label}</label>
                <input
                  type={f.type} className="form-control"
                  placeholder={f.placeholder||''}
                  value={form[f.key]}
                  onChange={e=>setForm(x=>({...x,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <button onClick={handleCreate} disabled={loading} className="btn btn-primary w-100 mt-2">
              {loading?'Creating...':'Create Viewer Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function I18nPage() {
  const [lang, setLang] = useState('hi');
  const [editKey, setEditKey] = useState('');
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving]   = useState(false);
  const { data, loading, reload } = useData(() => api.getStrings(lang), [lang]);
  const strings = data?.strings || {};

  const handleSave = async () => {
    if (!editKey.trim()||!editVal.trim()) return;
    setSaving(true);
    const r = await api.upsertString({ key: editKey, lang, value: editVal });
    setSaving(false);
    if (r.ok) { toast('✅ String updated!'); reload(); setEditKey(''); setEditVal(''); }
    else toast(r.error,'error');
  };

  return (
    <div className="animate-fade">
      <div style={{display:'flex',gap:12,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
        <div className="tabs">
          <button className={`tab-btn ${lang==='hi'?'active':''}`} onClick={()=>setLang('hi')}>🇮🇳 Hindi</button>
          <button className={`tab-btn ${lang==='en'?'active':''}`} onClick={()=>setLang('en')}>🇬🇧 English</button>
        </div>
        <span style={{fontSize:'0.82rem',color:'var(--gray-400)'}}>{Object.keys(strings).length} strings</span>
      </div>
      <div className="grid-2" style={{alignItems:'flex-start'}}>
        <div className="table-wrap">
          <div className="table-toolbar"><div className="table-title">App UI Strings ({lang})</div></div>
          <div style={{maxHeight:400,overflowY:'auto'}}>
            <table>
              <thead><tr><th>Key</th><th>Value</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={3} style={{textAlign:'center',padding:32}}>Loading...</td></tr>}
                {Object.entries(strings).map(([k,v])=>(
                  <tr key={k} onClick={()=>{setEditKey(k);setEditVal(v);}} style={{cursor:'pointer'}}>
                    <td><code style={{fontSize:'0.75rem'}}>{k}</code></td>
                    <td style={{fontSize:'0.85rem'}}>{v}</td>
                    <td><button className="btn btn-ghost btn-sm" style={{fontSize:'0.72rem'}}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h4>Edit / Add String</h4></div>
          <div className="card-body">
            <div className="form-group"><label>Key</label><input placeholder="e.g. accept" value={editKey} onChange={e=>setEditKey(e.target.value)} /></div>
            <div className="form-group"><label>Value ({lang})</label><textarea rows={2} placeholder={lang==='hi'?'हिंदी में...':'In English...'} value={editVal} onChange={e=>setEditVal(e.target.value)} /></div>
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving?'Saving...':'Save String'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STALLED BOOKINGS page ──────────────────────────────────
function StalledPage() {
  const { data, loading, reload } = useData(api.getStalledBookings);
  const bookings = data?.stalledBookings || [];
  const handleCancel = async (id) => {
    const r = await api.cancelStalledBooking(id);
    if (r.ok) { toast('Booking cancelled, refund initiated'); reload(); }
    else toast(r.error,'error');
  };
  return (
    <div className="animate-fade">
      <div className="alert alert-warn" style={{marginBottom:20}}>
        ⏳ These bookings were accepted by a porter but no action taken for 24+ hours. User may be waiting.
      </div>
      {loading && <div style={{textAlign:'center',padding:40}}>Loading...</div>}
      {!loading && bookings.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div><h4>No stalled bookings</h4></div>}
      {bookings.map((b,i)=>(
        <div key={i} className="card" style={{marginBottom:14,borderLeft:'4px solid var(--amber)'}}>
          <div className="card-body" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{fontWeight:700}}>{b.id}</div>
              <div style={{fontSize:'0.82rem',color:'var(--gray-500)',marginTop:4}}>
                Porter: {b.porter_name_db||'—'} · {b.porter_phone} · Station: {b.arrival_station}
              </div>
              <div style={{fontSize:'0.78rem',color:'var(--amber)',marginTop:4}}>
                Accepted {new Date(b.accepted_at).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-danger btn-sm" onClick={()=>handleCancel(b.id)}>Cancel + Refund</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP SHELL ─────────────────────────────────────────
function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [alerts, setAlerts] = useState({});

  // Poll for alerts every 30 seconds
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      const r = await api.getStats();
      if (r.ok) {
        setAlerts({
          pendingPorters: r.data.porters?.pending || 0,
          fraudFlags:     r.data.pendingFraudAlerts || 0,
          openDisputes:   r.data.openDisputes || 0,
          activeSOS:      0, // fetched separately
        });
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <img src="/logo.png" alt="HelloCoolie" style={{ height: 56 }} />
      <div className="spinner spinner-orange" style={{ width:36, height:36, borderWidth:3 }} />
    </div>
  );

  if (!user) return <LoginPage />;

  const isAdmin = user.role === 'admin';
  const meta    = PAGE_META[page] || { title: page, sub: '' };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return isAdmin ? <DashboardPage /> : <SearchPage />;
      case 'search':     return <SearchPage />;
      case 'stations':   return isAdmin ? <DashboardPage /> : null;
      case 'bookings':   return <BookingsPage />;
      case 'porters':    return <PortersPage />;
      case 'users':      return <UsersPage />;
      case 'fraud':      return <FraudPage />;
      case 'disputes':   return <DisputesPage isViewer={!isAdmin} />;
      case 'sos':        return <SOSPage />;
      case 'surge':      return <SurgePage />;
      case 'offline':    return <OfflineFeesPage />;
      case 'viewers':    return <ViewersPage />;
      case 'i18n':       return <I18nPage />;
      case 'stalled':    return <StalledPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={page} onNavigate={setPage} alerts={alerts} />
      <div className="main-area">
        <Topbar
          title={meta.title}
          subtitle={meta.sub}
          actions={
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
              {isAdmin ? '👑 Admin' : '👁️ Viewer'}
            </span>
          }
        />
        <div className="page-content">{renderPage()}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
