import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { StatCard, fmt } from '../../components/shared';
import { useData } from '../../hooks/useAuth';
import api from '../../services/api';

const PIE_COLORS = ['#F47920','#1B75BB','#16A34A','#D97706','#DC2626'];

export default function DashboardPage() {
  const { data: stats, loading: sLoad } = useData(api.getStats);
  const { data: stationsData }          = useData(api.getStations);

  const stations = stationsData?.stations || [];
  const topStations = [...stations].sort((a,b) => parseFloat(b.platform_revenue) - parseFloat(a.platform_revenue)).slice(0,6);

  const bookingStatusData = stats ? [
    { name: 'Completed', value: parseInt(stats.bookings?.completed || 0),   color: '#16A34A' },
    { name: 'Pending',   value: parseInt(stats.bookings?.pending   || 0),   color: '#D97706' },
    { name: 'Active',    value: parseInt(stats.bookings?.total || 0) - parseInt(stats.bookings?.completed || 0) - parseInt(stats.bookings?.pending || 0), color: '#1B75BB' },
  ] : [];

  const porterStatusData = stats ? [
    { name: 'Approved',  value: parseInt(stats.porters?.approved  || 0), color: '#16A34A' },
    { name: 'Pending',   value: parseInt(stats.porters?.pending   || 0), color: '#D97706' },
    { name: 'Suspended', value: parseInt(stats.porters?.suspended || 0), color: '#DC2626' },
    { name: 'Online Now',value: parseInt(stats.porters?.online    || 0), color: '#1B75BB' },
  ] : [];

  if (sLoad) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div className="spinner spinner-orange" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <p>Loading dashboard...</p>
    </div>
  );

  return (
    <div className="animate-fade">
      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard icon="💰" label="Total Platform Revenue" color="orange"
          value={fmt.currency(stats?.revenue?.total)}
          sub={`${fmt.currency(stats?.revenue?.today)} today`} />
        <StatCard icon="📋" label="Total Bookings" color="blue"
          value={stats?.bookings?.total}
          sub={`${stats?.bookings?.today} bookings today`} />
        <StatCard icon="🔴" label="Active Porters" color="green"
          value={stats?.porters?.approved}
          sub={`${stats?.porters?.online} online now · ${stats?.porters?.pending} pending approval`} />
        <StatCard icon="👤" label="Registered Users" color="amber"
          value={stats?.users?.active}
          sub={`${stats?.users?.banned || 0} banned`} />
      </div>

      {/* Alert strip */}
      {(stats?.pendingFraudAlerts > 0 || stats?.openDisputes > 0) && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          ⚠️ You have <strong>{stats.pendingFraudAlerts}</strong> fraud alert(s) and <strong>{stats.openDisputes}</strong> open dispute(s) requiring attention.
        </div>
      )}

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* Top stations bar chart */}
        <div className="card">
          <div className="card-header">
            <h4>Top Stations by Revenue</h4>
            <span className="badge badge-orange">Platform fee ₹</span>
          </div>
          <div className="card-body" style={{ padding: '16px 12px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStations} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} tickFormatter={v => v.split(' ')[0]} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} tickFormatter={v => `₹${v/1000}k`} />
                <Tooltip formatter={(v) => fmt.currency(v)} labelStyle={{ fontWeight: 700 }} />
                <Bar dataKey="platform_revenue" fill="var(--orange)" radius={[4,4,0,0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Booking status pie */}
        <div className="card">
          <div className="card-header">
            <h4>Booking Status Breakdown</h4>
          </div>
          <div className="card-body" style={{ padding: '16px 12px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bookingStatusData} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={40}>
                  {bookingStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: '0.8rem' }}>{v}</span>} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Porter status + Station table */}
      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* Porter status pie */}
        <div className="card">
          <div className="card-header">
            <h4>Porter Account Status</h4>
          </div>
          <div className="card-body" style={{ padding: '16px 12px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porterStatusData} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={75} innerRadius={35}>
                  {porterStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: '0.8rem' }}>{v}</span>} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Platform fee (normal)', val: '15%', icon: '💳', color: 'var(--orange)' },
            { label: 'Platform fee (festival)', val: '25%', icon: '🎉', color: 'var(--blue)' },
            { label: 'Porter cancel threshold', val: '3 in 7 days', icon: '🚨', color: 'var(--red)' },
            { label: 'Dispute SLA', val: '2 hours', icon: '⚖️', color: 'var(--amber)' },
            { label: 'Booking notification', val: '30 seconds', icon: '⏱️', color: 'var(--green)' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{item.label}</div>
                <div style={{ fontWeight: 700, color: item.color }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Station table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-title">Station-wise Summary</div>
          <span className="badge badge-blue">{stations.length} stations</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>City Tier</th>
                <th>Porters</th>
                <th>Bookings</th>
                <th>Completed</th>
                <th>Platform Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stations.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-400)' }}>No station data yet</td></tr>
              ) : stations.map((s, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🚉</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{s.city}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge badge-${s.city_tier === 'x' ? 'orange' : 'blue'}`}>Tier {s.city_tier?.toUpperCase()}</span></td>
                  <td style={{ fontWeight: 600 }}>{s.total_porters}</td>
                  <td>{s.total_bookings}</td>
                  <td>{s.completed_bookings}</td>
                  <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmt.currency(s.platform_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
