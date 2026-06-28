// ═══════════════════════════════════════════════════════════
//  pages/admin/UsersPage.jsx
// ═══════════════════════════════════════════════════════════
import React, { useState, useCallback } from 'react';
import { DataTable, Modal, statusBadge, fmt, toast, useConfirm } from '../../components/shared';
import { useData } from '../../hooks/useAuth';
import api from '../../services/api';

export function UsersPage() {
  const [filter, setFilter] = useState('active');
  const { confirm, Dialog } = useConfirm();
  const { data, loading, reload } = useData(
    useCallback(() => api.getUsers(`?filter=${filter}`), [filter]), [filter]
  );
  const users = data?.users || [];

  const handleBan = async (id, name) => {
    const ok = await confirm(`Ban user ${name}? They will no longer be able to make bookings.`);
    if (!ok) return;
    const r = await api.banUser(id);
    if (r.ok) { toast('User banned', 'warn'); reload(); }
    else toast(r.error, 'error');
  };

  const handleUnban = async (id, name) => {
    const ok = await confirm(`Unban user ${name}?`);
    if (!ok) return;
    const r = await api.unbanUser(id);
    if (r.ok) { toast('✅ User unbanned!'); reload(); }
    else toast(r.error, 'error');
  };

  const columns = [
    { key:'name', label:'Passenger', render:(v,row)=>(
      <div className="td-user">
        <div className="avatar avatar-blue">{v?.[0]}</div>
        <div><div style={{fontWeight:600}}>{v}</div><div style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{fmt.phone(row.phone)}</div></div>
      </div>
    )},
    { key:'gender',         label:'Gender',   render:v=>v||'—' },
    { key:'is_senior',      label:'Senior',   render:v=>v?'👴 Yes':'—' },
    { key:'total_bookings', label:'Bookings' },
    { key:'is_active',      label:'Status',   render:(v,row)=>statusBadge(row.is_banned?'inactive':v?'active':'inactive') },
    { key:'created_at',     label:'Joined',   render:v=>fmt.date(v) },
    { key:'id', label:'Actions', render:(id,row)=>(
      <div style={{display:'flex',gap:6}}>
        {!row.is_banned
          ? <button className="btn btn-danger btn-sm" onClick={()=>handleBan(id,row.name)}>Ban</button>
          : <button className="btn btn-success btn-sm" onClick={()=>handleUnban(id,row.name)}>Unban</button>
        }
      </div>
    )},
  ];

  return (
    <div className="animate-fade">
      <Dialog />
      <div className="tabs" style={{marginBottom:20}}>
        {['active','inactive','banned'].map(f=>(
          <button key={f} className={`tab-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
            {f==='active'?'✅ Active':f==='inactive'?'○ Inactive':'🚫 Banned'}
          </button>
        ))}
      </div>
      <DataTable title="Passengers" columns={columns} rows={users} loading={loading} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/admin/BookingsPage.jsx
// ═══════════════════════════════════════════════════════════
export function BookingsPage() {
  const [filter, setFilter] = useState('');
  const { data, loading } = useData(
    useCallback(()=>api.getAllBookings(filter?`?status=${filter}`:''),[filter]),[filter]
  );
  const bookings = data?.bookings || [];

  const columns = [
    { key:'id',            label:'Booking ID',  render:v=><code style={{fontSize:'0.75rem',background:'var(--gray-100)',padding:'2px 8px',borderRadius:4}}>{v}</code> },
    { key:'traveller_name',label:'Passenger' },
    { key:'porter_name',   label:'Porter',      render:v=>v||<span style={{color:'var(--gray-400)'}}>Unassigned</span> },
    { key:'arrival_station',label:'Station' },
    { key:'bag_count',     label:'Bags',        render:(v,row)=>`${v} (${row.bag_weight})` },
    { key:'total_amount',  label:'Total',       render:v=>fmt.currency(v) },
    { key:'platform_fee',  label:'Platform Fee',render:v=><span style={{color:'var(--orange)',fontWeight:600}}>{fmt.currency(v)}</span> },
    { key:'payment_method',label:'Payment',     render:v=>statusBadge(v) },
    { key:'status',        label:'Status',      render:v=>statusBadge(v) },
    { key:'created_at',    label:'Date',        render:v=>fmt.datetime(v) },
  ];

  return (
    <div className="animate-fade">
      <div className="tabs" style={{marginBottom:20}}>
        {[{id:'',label:'All'},{id:'pending',label:'⏳ Pending'},{id:'accepted',label:'✓ Accepted'},{id:'in_progress',label:'▶ Active'},{id:'completed',label:'✅ Done'},{id:'cancelled_by_user',label:'✕ User Cancel'},{id:'cancelled_by_porter',label:'✕ Porter Cancel'},{id:'disputed',label:'⚠️ Disputed'}].map(f=>(
          <button key={f.id} className={`tab-btn ${filter===f.id?'active':''}`} onClick={()=>setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      <DataTable title="All Bookings" columns={columns} rows={bookings} loading={loading} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/admin/DisputesPage.jsx
// ═══════════════════════════════════════════════════════════

export function DisputesPage({ isViewer = false }) {
  const [status, setStatus]     = useState('open');
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState('');
  const [refundUser,     setRefundUser]     = useState(false);
  const [penalisePorter, setPenalisePorter] = useState(false);

  const fetcher = useCallback(() => {
    return isViewer ? api.getMyDisputes() : api.getDisputes(status);
  }, [isViewer, status]);
  const { data, loading, reload } = useData(fetcher, [status, isViewer]);
  const disputes = (isViewer ? data?.myDisputes : data?.disputes) || [];

  const handleResolve = async () => {
    if (!resolution.trim()) { toast('Resolution description required','warn'); return; }
    const r = await api.resolveDispute(selected.id, { resolution, refund_user: refundUser, penalise_porter: penalisePorter });
    if (r.ok) { toast('✅ Dispute resolved!'); setSelected(null); setResolution(''); reload(); }
    else toast(r.error, 'error');
  };

  const columns = [
    { key:'booking_id',    label:'Booking ID',  render:v=><code style={{fontSize:'0.75rem'}}>{v}</code> },
    { key:'raised_by',     label:'Raised By',   render:v=><span className={`badge ${v==='user'?'badge-blue':'badge-orange'}`}>{v==='user'?'👤 User':'🔴 Porter'}</span> },
    { key:'user_name',     label:'Passenger' },
    { key:'porter_name',   label:'Porter' },
    { key:'arrival_station',label:'Station' },
    { key:'description',   label:'Issue',       render:v=><span style={{fontSize:'0.8rem',maxWidth:200,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span> },
    { key:'status',        label:'Status',      render:v=>statusBadge(v) },
    {
      key:'sla_deadline', label:'SLA',
      render:(v,row) => {
        if (!v) return '—';
        const mins = Math.floor((new Date(v)-new Date())/60000);
        if (mins < 0) return <span style={{color:'var(--red)',fontWeight:700}}>⚠️ Breached</span>;
        return <span style={{color:mins<30?'var(--red)':mins<60?'var(--amber)':'var(--green)',fontWeight:600}}>{mins}m left</span>;
      }
    },
    { key:'created_at',    label:'Raised',      render:v=>fmt.datetime(v) },
    { key:'id', label:'Action', render:(id,row)=>(
      <button className="btn btn-blue btn-sm" onClick={()=>setSelected(row)}>Investigate</button>
    )},
  ];

  return (
    <div className="animate-fade">
      {!isViewer && (
        <div className="tabs" style={{marginBottom:20}}>
          {['open','investigating','resolved','closed'].map(s=>(
            <button key={s} className={`tab-btn ${status===s?'active':''}`} onClick={()=>setStatus(s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      )}

      <DataTable
        title={isViewer ? 'My Assigned Disputes' : 'All Disputes'}
        columns={columns} rows={disputes} loading={loading}
        emptyMsg="No disputes found 🎉"
      />

      <Modal open={!!selected} onClose={()=>{setSelected(null);setResolution('');}} title={`Dispute — ${selected?.booking_id}`} width={560}>
        {selected && (
          <div>
            <div style={{background:'var(--gray-50)',borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{fontSize:'0.78rem',color:'var(--gray-500)',marginBottom:4}}>Issue reported:</div>
              <div style={{fontWeight:500}}>{selected.description}</div>
            </div>
            <div className="grid-2" style={{marginBottom:16}}>
              <div><div style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>PASSENGER</div><div style={{fontWeight:600}}>{selected.user_name||'—'}</div></div>
              <div><div style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>PORTER</div><div style={{fontWeight:600}}>{selected.porter_name||'—'}</div></div>
              <div><div style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>AMOUNT</div><div style={{fontWeight:600,color:'var(--orange)'}}>{fmt.currency(selected.total_amount)}</div></div>
              <div><div style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>STATION</div><div style={{fontWeight:600}}>{selected.arrival_station}</div></div>
            </div>
            <div className="form-group">
              <label>Resolution *</label>
              <textarea rows={3} placeholder="Describe the resolution..." value={resolution} onChange={e=>setResolution(e.target.value)} />
            </div>
            <div style={{display:'flex',gap:16,marginBottom:16}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.875rem',fontWeight:500}}>
                <input type="checkbox" checked={refundUser} onChange={e=>setRefundUser(e.target.checked)} />
                💳 Refund passenger
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.875rem',fontWeight:500}}>
                <input type="checkbox" checked={penalisePorter} onChange={e=>setPenalisePorter(e.target.checked)} />
                ⚠️ Penalise porter
              </label>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-ghost btn-full" onClick={()=>setSelected(null)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={handleResolve}>✓ Resolve Dispute</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/admin/SOSPage.jsx
// ═══════════════════════════════════════════════════════════
export function SOSPage() {
  const { data, loading, reload } = useData(api.getActiveSOS);
  const alerts = data?.activeSOS || [];

  const handleResolve = async (id) => {
    const r = await api.resolveSOS(id);
    if (r.ok) { toast('SOS resolved'); reload(); }
    else toast(r.error,'error');
  };

  return (
    <div className="animate-fade">
      {alerts.length > 0 && (
        <div className="alert alert-danger" style={{marginBottom:20}}>
          <span className="sos-dot" style={{marginRight:8}} />
          <strong>{alerts.length} active SOS alert(s)</strong> — Respond immediately!
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {loading && <div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Loading...</div>}
        {!loading && alerts.length === 0 && (
          <div className="empty-state"><div className="empty-icon">✅</div><h4>No active SOS alerts</h4><p>All clear!</p></div>
        )}
        {alerts.map(sos=>(
          <div key={sos.id} className="card" style={{borderLeft:'4px solid var(--red)'}}>
            <div className="card-body">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <span style={{fontSize:'1.5rem'}}>🆘</span>
                    <span style={{fontWeight:800,fontSize:'1rem',color:'var(--red)'}}>
                      {sos.raised_by==='porter'?'PORTER SOS':'USER SOS'}
                    </span>
                    <span className="sos-dot" />
                  </div>
                  <div style={{fontWeight:600,fontSize:'1rem'}}>{sos.porter_name||sos.user_name}</div>
                  <div style={{color:'var(--gray-500)',fontSize:'0.85rem'}}>{fmt.phone(sos.porter_phone||sos.user_phone)}</div>
                  {sos.emergency_contact && <div style={{marginTop:4,color:'var(--amber)',fontSize:'0.8rem'}}>Emergency contact: {fmt.phone(sos.emergency_contact)}</div>}
                  {sos.arrival_station && <div style={{marginTop:4,color:'var(--gray-500)',fontSize:'0.82rem'}}>📍 {sos.arrival_station} · Train {sos.train_no} · Coach {sos.coach}</div>}
                  {sos.latitude && (
                    <a href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`} target="_blank" rel="noreferrer"
                      style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:8,color:'var(--blue)',fontSize:'0.82rem',fontWeight:600}}>
                      📍 Open in Google Maps →
                    </a>
                  )}
                  <div style={{marginTop:6,fontSize:'0.75rem',color:'var(--gray-400)'}}>Raised: {fmt.datetime(sos.created_at)}</div>
                </div>
                <button className="btn btn-success" onClick={()=>handleResolve(sos.id)}>✓ Mark Resolved</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/admin/SurgePage.jsx
// ═══════════════════════════════════════════════════════════
export function SurgePage() {
  const [form, setForm] = useState({ name:'', start_date:'', end_date:'', season_type:'festival', platform_fee_pct:25 });
  const [showForm, setShowForm] = useState(false);
  const { data, loading, reload } = useData(api.getSurgeConfigs);
  const configs = data?.configs || [];

  const handleCreate = async () => {
    if (!form.name||!form.start_date||!form.end_date) { toast('Fill all fields','warn'); return; }
    const r = await api.createSurge(form);
    if (r.ok) { toast('✅ Surge config created!'); setShowForm(false); reload(); }
    else toast(r.error,'error');
  };

  return (
    <div className="animate-fade">
      <div style={{marginBottom:20,display:'flex',justifyContent:'flex-end'}}>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Add Festival Surge</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16,marginBottom:24}}>
        {/* City tier pricing cards */}
        {[
          {tier:'X (Metro)',pct:20,eg:'Mumbai, Delhi, Bangalore, Chennai'},
          {tier:'Y (Tier 2)',pct:15,eg:'Lucknow, Jaipur, Patna, Surat'},
          {tier:'Z (Tier 3)',pct:15,eg:'Panipat, Karnal, Ambala, Rohtak'},
        ].map(c=>(
          <div key={c.tier} className="card" style={{borderTop:'3px solid var(--orange)'}}>
            <div className="card-body">
              <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.05em'}}>City Tier</div>
              <div style={{fontSize:'1.3rem',fontWeight:900,fontFamily:'var(--font-display)',margin:'4px 0'}}>{c.tier}</div>
              <div style={{fontSize:'2rem',fontWeight:900,color:'var(--orange)',fontFamily:'var(--font-display)'}}>{c.pct}%</div>
              <div style={{fontSize:'0.78rem',color:'var(--gray-400)',marginTop:4}}>Platform fee (normal season)</div>
              <div style={{marginTop:8,fontSize:'0.78rem',color:'var(--gray-600)',borderTop:'1px solid var(--gray-100)',paddingTop:8}}>{c.eg}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-toolbar"><div className="table-title">Festival Surge Configs</div></div>
        <table>
          <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Type</th><th>Platform Fee</th><th>Status</th></tr></thead>
          <tbody>
            {configs.length===0
              ? <tr><td colSpan={6} style={{textAlign:'center',padding:'32px',color:'var(--gray-400)'}}>No surge configs yet</td></tr>
              : configs.map((c,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600}}>{c.name}</td>
                  <td>{fmt.date(c.start_date)}</td>
                  <td>{fmt.date(c.end_date)}</td>
                  <td><span className="badge badge-amber">🎉 {c.season_type}</span></td>
                  <td style={{fontWeight:700,color:'var(--orange)'}}>{c.platform_fee_pct}%</td>
                  <td>{statusBadge(c.is_active?'active':'inactive')}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Add Festival Surge Pricing">
        <div>
          <div className="form-group"><label>Festival Name *</label><input placeholder="e.g. Diwali 2026" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          <div className="grid-2">
            <div className="form-group"><label>Start Date *</label><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} /></div>
            <div className="form-group"><label>End Date *</label><input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} /></div>
          </div>
          <div className="form-group"><label>Platform Fee % (festival rate)</label><input type="number" value={form.platform_fee_pct} min={10} max={50} onChange={e=>setForm(f=>({...f,platform_fee_pct:parseFloat(e.target.value)}))} /></div>
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button className="btn btn-ghost btn-full" onClick={()=>setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-full" onClick={handleCreate}>Create Surge Config</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/admin/FraudPage.jsx
// ═══════════════════════════════════════════════════════════
export function FraudPage() {
  const { data, loading, reload } = useData(api.getFraudFlags);
  const flags = data?.flags || [];

  const handleReview = async (id, action) => {
    const r = await api.reviewFraudFlag(id, action);
    if (r.ok) { toast('Fraud flag reviewed'); reload(); }
    else toast(r.error,'error');
  };

  const columns = [
    { key:'porter_name',  label:'Porter',     render:(v,r)=><div><div style={{fontWeight:600}}>{v}</div><div style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>{fmt.phone(r.porter_phone)}</div></div> },
    { key:'station',      label:'Station' },
    { key:'flag_type',    label:'Flag Type',  render:v=><span className="badge badge-red">{v.replace('_',' ')}</span> },
    { key:'booking_id',   label:'Booking',    render:v=><code style={{fontSize:'0.75rem'}}>{v||'—'}</code> },
    { key:'description',  label:'Details',    render:v=><span style={{fontSize:'0.8rem'}}>{v}</span> },
    { key:'auto_flagged', label:'Source',     render:v=><span className={`badge ${v?'badge-amber':'badge-blue'}`}>{v?'Auto':'Manual'}</span> },
    { key:'created_at',   label:'Flagged',    render:v=>fmt.datetime(v) },
    { key:'id', label:'Action', render:(id)=>(
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-success btn-sm" onClick={()=>handleReview(id,'Investigated — warning issued')}>✓ Reviewed</button>
        <button className="btn btn-danger btn-sm"  onClick={()=>handleReview(id,'Confirmed fraud — account suspended')}>⊘ Suspend</button>
      </div>
    )},
  ];

  return (
    <div className="animate-fade">
      <div className="alert alert-warn" style={{marginBottom:20}}>
        ⚠️ <strong>{flags.length}</strong> unreviewed fraud flag(s). Porters flagged for frequent cancellations may be directly dealing with passengers outside the app.
      </div>
      <DataTable title="Fraud Alerts" columns={columns} rows={flags} loading={loading} emptyMsg="No fraud flags — all clear! 🎉" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  pages/viewer/SearchPage.jsx — Viewer searches by booking ID
// ═══════════════════════════════════════════════════════════
export function SearchPage() {
  const [bookingId, setBookingId] = useState('');
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleSearch = async () => {
    if (!bookingId.trim()) return;
    setLoading(true); setError(''); setResult(null);
    const r = await api.getBookingById(bookingId.trim());
    setLoading(false);
    if (r.ok) setResult(r.data);
    else setError(r.error);
  };

  const b = result?.booking;

  return (
    <div className="animate-fade">
      <div className="card" style={{marginBottom:24}}>
        <div className="card-body">
          <h4 style={{marginBottom:12}}>Search Booking by ID</h4>
          <div style={{display:'flex',gap:10}}>
            <input
              placeholder="Enter Booking ID (e.g. BK1782659826372)"
              value={bookingId} onChange={e=>setBookingId(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              style={{flex:1}}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading?<span className="spinner"/>:'🔍 Search'}
            </button>
          </div>
          {error && <div className="alert alert-danger" style={{marginTop:12}}>{error}</div>}
        </div>
      </div>

      {b && (
        <div className="animate-fade">
          {/* Status bar */}
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',background:'white',borderRadius:12,border:'1px solid var(--gray-100)',marginBottom:20,flexWrap:'wrap'}}>
            <div style={{fontWeight:800,fontFamily:'var(--font-display)'}}>{b.id}</div>
            {statusBadge(b.status)}
            {statusBadge(b.payment_method)}
            <div style={{marginLeft:'auto',fontSize:'0.78rem',color:'var(--gray-400)'}}>Created: {fmt.datetime(b.created_at)}</div>
          </div>

          <div className="grid-2" style={{marginBottom:20}}>
            {/* Passenger */}
            <div className="card">
              <div className="card-header"><h4>👤 Passenger</h4></div>
              <div className="card-body">
                {[
                  ['Name',    b.traveller_name],
                  ['Phone',   fmt.phone(b.traveller_phone)],
                  ['Age',     b.traveller_age],
                  ['Gender',  b.traveller_gender],
                  ['Senior',  b.is_senior?'Yes':'No'],
                  ['Solo Woman', b.is_woman_solo?'Yes':'No'],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--gray-50)'}}>
                    <span style={{color:'var(--gray-400)',fontSize:'0.82rem'}}>{l}</span>
                    <span style={{fontWeight:600,fontSize:'0.82rem'}}>{v||'—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Porter */}
            <div className="card">
              <div className="card-header"><h4>🔴 Porter</h4></div>
              <div className="card-body">
                {[
                  ['Name',    b.porter_name_db||b.porter_name||'Not assigned'],
                  ['Phone',   fmt.phone(b.porter_phone_db||b.porter_phone)],
                  ['Badge',   b.badge_no],
                  ['Rating',  b.porter_rating_db>0?`★ ${b.porter_rating_db}`:'—'],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--gray-50)'}}>
                    <span style={{color:'var(--gray-400)',fontSize:'0.82rem'}}>{l}</span>
                    <span style={{fontWeight:600,fontSize:'0.82rem'}}>{v||'—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Journey */}
            <div className="card">
              <div className="card-header"><h4>🚂 Journey</h4></div>
              <div className="card-body">
                {[
                  ['Train',   `${b.train_name||''} #${b.train_no||'—'}`],
                  ['From',    b.from_station],
                  ['To',      b.to_station],
                  ['Arrival', b.arrival_station],
                  ['Coach',   b.coach],
                  ['Seat',    b.seat_no],
                  ['PNR',     b.pnr],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--gray-50)'}}>
                    <span style={{color:'var(--gray-400)',fontSize:'0.82rem'}}>{l}</span>
                    <span style={{fontWeight:600,fontSize:'0.82rem'}}>{v||'—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment */}
            <div className="card">
              <div className="card-header"><h4>💰 Fare Breakdown</h4></div>
              <div className="card-body">
                {[
                  ['Base Fare',     fmt.currency(b.base_fare)],
                  ['Bag Fare',      fmt.currency(b.bag_fare)],
                  ['Distance',      fmt.currency(b.distance_fare)],
                  ['Bags',          `${b.bag_count} (${b.bag_weight})`],
                  ['Drop',          b.drop_location],
                  ['City Tier',     `Tier ${b.city_tier?.toUpperCase()}`],
                  ['Season',        b.season_type],
                  ['Platform Fee',  `${b.platform_fee_pct}% = ${fmt.currency(b.platform_fee)}`],
                  ['Porter Gets',   fmt.currency(b.porter_amount)],
                  ['Total',         fmt.currency(b.total_amount)],
                ].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--gray-50)'}}>
                    <span style={{color:'var(--gray-400)',fontSize:'0.82rem'}}>{l}</span>
                    <span style={{fontWeight:l==='Total'?800:600,fontSize:'0.82rem',color:l==='Total'?'var(--orange)':l==='Platform Fee'?'var(--blue)':'inherit'}}>{v||'—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notification timeline */}
          {result?.notificationTimeline?.length > 0 && (
            <div className="card">
              <div className="card-header"><h4>📡 Porter Notification Timeline</h4></div>
              <div className="card-body">
                <table style={{width:'100%',fontSize:'0.82rem'}}>
                  <thead><tr><th style={{padding:'8px 0',textAlign:'left',color:'var(--gray-500)',fontSize:'0.72rem',textTransform:'uppercase'}}>Porter</th><th>Notified At</th><th>Response</th><th>Response Time</th></tr></thead>
                  <tbody>
                    {result.notificationTimeline.map((n,i)=>(
                      <tr key={i}>
                        <td style={{padding:'8px 0',fontWeight:600}}>{n.porter_id?.slice(0,8)}...</td>
                        <td style={{padding:'8px 0'}}>{fmt.datetime(n.notified_at)}</td>
                        <td style={{padding:'8px 0'}}><span className={`badge ${n.response==='accepted'?'badge-green':n.response==='rejected'?'badge-red':'badge-gray'}`}>{n.response||'no response'}</span></td>
                        <td style={{padding:'8px 0'}}>{n.responded_at?fmt.datetime(n.responded_at):'Timed out'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dispute if any */}
          {b.dispute_desc && (
            <div className="card" style={{borderLeft:'4px solid var(--red)',marginTop:16}}>
              <div className="card-body">
                <div style={{fontWeight:700,marginBottom:8,color:'var(--red)'}}>⚖️ Dispute</div>
                <div style={{fontSize:'0.875rem'}}>{b.dispute_desc}</div>
                <div style={{marginTop:8}}>{statusBadge(b.dispute_status)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
