import React, { useState, useCallback } from 'react';
import { DataTable, Modal, statusBadge, fmt, toast, useConfirm } from '../../components/shared';
import { useData } from '../../hooks/useAuth';
import api from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PortersPage() {
  const [filter, setFilter]         = useState('pending');
  const [selectedPorter, setSelected] = useState(null);
  const [earningsPorter, setEarnings] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendModal, setSuspendModal]   = useState(null);
  const { confirm, Dialog }               = useConfirm();

  const { data, loading, reload } = useData(
    useCallback(() => api.getPorters(`?filter=${filter}`), [filter]),
    [filter]
  );

  const porters = data?.porters || [];

  const handleApprove = async (id, name) => {
    const ok = await confirm(`Approve porter ${name}? They will be able to login and accept bookings.`);
    if (!ok) return;
    const r = await api.approvePorter(id);
    if (r.ok) { toast('✅ Porter approved!'); reload(); }
    else toast(r.error, 'error');
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { toast('Please provide a reason', 'warn'); return; }
    const r = await api.suspendPorter(suspendModal.id, suspendReason);
    if (r.ok) { toast('Porter suspended', 'warn'); setSuspendModal(null); setSuspendReason(''); reload(); }
    else toast(r.error, 'error');
  };

  const handleReactivate = async (id, name) => {
    const ok = await confirm(`Reactivate porter ${name}?`);
    if (!ok) return;
    const r = await api.reactivatePorter(id);
    if (r.ok) { toast('✅ Porter reactivated!'); reload(); }
    else toast(r.error, 'error');
  };

  const loadEarnings = async (porter) => {
    const r = await api.getPorterEarnings(porter.id);
    if (r.ok) setEarnings({ porter, data: r.data });
    else toast(r.error, 'error');
  };

  const columns = [
    {
      key: 'name', label: 'Porter',
      render: (v, row) => (
        <div className="td-user">
          <div className={`avatar ${row.status === 'approved' ? 'avatar-orange' : 'avatar-blue'}`}>{v?.[0]}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{fmt.phone(row.phone)}</div>
          </div>
        </div>
      )
    },
    { key: 'badge_no',  label: 'Badge', render: v => <code style={{ fontSize: '0.8rem', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4 }}>{v}</code> },
    { key: 'station',   label: 'Station' },
    {
      key: 'is_online', label: 'Status',
      render: (v, row) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusBadge(row.status)}
          {row.status === 'approved' && statusBadge(v ? 'online' : 'offline')}
        </div>
      )
    },
    { key: 'rating',          label: 'Rating',    render: v => v > 0 ? `★ ${Number(v).toFixed(1)}` : '—' },
    { key: 'total_bookings',  label: 'Trips' },
    { key: 'total_cancellations', label: 'Cancels', render: v => <span style={{ color: v > 3 ? 'var(--red)' : 'inherit', fontWeight: v > 3 ? 700 : 400 }}>{v || 0}</span> },
    { key: 'wallet_balance',  label: 'Wallet',    render: v => fmt.currency(v) },
    {
      key: 'id', label: 'Actions',
      render: (id, row) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(row)}>View</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--blue)' }} onClick={() => loadEarnings(row)}>💰</button>
          {row.status === 'pending'   && <button className="btn btn-success btn-sm" onClick={() => handleApprove(id, row.name)}>✓ Approve</button>}
          {row.status === 'approved'  && <button className="btn btn-danger btn-sm"  onClick={() => setSuspendModal(row)}>⊘ Suspend</button>}
          {row.status === 'suspended' && <button className="btn btn-blue btn-sm"    onClick={() => handleReactivate(id, row.name)}>↺ Reactivate</button>}
        </div>
      )
    },
  ];

  return (
    <div className="animate-fade">
      <Dialog />

      {/* Filter tabs */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          {[
            { id: 'pending',   label: '⏳ Pending Approval' },
            { id: 'approved',  label: '✅ Active Porters' },
            { id: 'suspended', label: '⊘ Suspended' },
            { id: 'inactive',  label: '○ Inactive' },
            { id: 'fraud',     label: '🚨 Fraud Flagged' },
          ].map(f => (
            <button key={f.id} className={`tab-btn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        title="Registered Porters"
        columns={columns}
        rows={porters}
        loading={loading}
        emptyMsg={`No ${filter} porters found`}
      />

      {/* Porter detail modal */}
      <Modal open={!!selectedPorter} onClose={() => setSelected(null)} title="Porter Details" width={600}>
        {selectedPorter && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: 16, background: 'var(--orange-bg)', borderRadius: 10 }}>
              <div className="avatar avatar-orange" style={{ width: 56, height: 56, fontSize: '1.4rem' }}>{selectedPorter.name?.[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedPorter.name}</div>
                <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{fmt.phone(selectedPorter.phone)}</div>
                <div style={{ marginTop: 4 }}>{statusBadge(selectedPorter.status)}</div>
              </div>
            </div>
            <div className="grid-2">
              {[
                ['Badge No.', selectedPorter.badge_no],
                ['Station',   selectedPorter.station],
                ['City Tier', `Tier ${selectedPorter.city_tier?.toUpperCase()}`],
                ['Shift',     selectedPorter.shift_type],
                ['Rating',    selectedPorter.rating > 0 ? `★ ${selectedPorter.rating}` : 'No ratings yet'],
                ['Experience',`${selectedPorter.experience_years} years`],
                ['Total Bookings',     selectedPorter.total_bookings],
                ['Cancellations',      selectedPorter.total_cancellations],
                ['Fraud Flags',        selectedPorter.fraud_flag_count],
                ['Wallet Balance',     fmt.currency(selectedPorter.wallet_balance)],
                ['Registered',         fmt.date(selectedPorter.created_at)],
                ['Approved',           fmt.date(selectedPorter.approved_at)],
              ].map(([label, value]) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{value || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Suspend modal */}
      <Modal open={!!suspendModal} onClose={() => { setSuspendModal(null); setSuspendReason(''); }} title={`Suspend ${suspendModal?.name}`}>
        {suspendModal && (
          <div>
            <div className="alert alert-warn">⚠️ This porter will immediately lose access and be marked offline.</div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Reason for suspension *</label>
              <textarea
                rows={3} placeholder="e.g. Frequent cancellations, direct dealing suspected..."
                value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setSuspendModal(null)}>Cancel</button>
              <button className="btn btn-danger btn-full" onClick={handleSuspend}>⊘ Suspend Porter</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Earnings modal */}
      <Modal open={!!earningsPorter} onClose={() => setEarnings(null)} title={`Earnings — ${earningsPorter?.porter?.name}`} width={640}>
        {earningsPorter?.data && (
          <div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
              {[
                { label: 'Today',    value: fmt.currency(earningsPorter.data.summary?.today?.earnings),   bookings: earningsPorter.data.summary?.today?.bookings },
                { label: 'This Week',value: fmt.currency(earningsPorter.data.summary?.week?.earnings),    bookings: earningsPorter.data.summary?.week?.bookings },
                { label: 'This Month',value:fmt.currency(earningsPorter.data.summary?.month?.earnings),   bookings: earningsPorter.data.summary?.month?.bookings },
                { label: 'All Time', value: fmt.currency(earningsPorter.data.summary?.allTime?.earnings), bookings: earningsPorter.data.summary?.allTime?.bookings },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--orange-bg)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--orange-dk)', fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--orange-dk)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{s.bookings} trips</div>
                </div>
              ))}
            </div>

            {earningsPorter.data.last7DaysChart?.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.875rem' }}>Last 7 Days</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={earningsPorter.data.last7DaysChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="day_name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                    <Tooltip formatter={v => fmt.currency(v)} />
                    <Bar dataKey="earnings" fill="var(--orange)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {earningsPorter.data.bestDay && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--green-bg)', borderRadius: 8 }}>
                🏆 <strong>Best day ever:</strong> {fmt.date(earningsPorter.data.bestDay.date)} — {fmt.currency(earningsPorter.data.bestDay.earnings)} ({earningsPorter.data.bestDay.bookings} trips)
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
