import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { fmt } from '../../components/shared';
import { useData } from '../../hooks/useAuth';
import api from '../../services/api';

const O = '#F47920';   // orange
const B = '#1B75BB';   // blue
const G = '#16A34A';   // green
const A = '#D97706';   // amber
const R = '#DC2626';   // red

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:8, padding:'8px 12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize:'0.75rem', color:'#6B7280', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ fontSize:'0.875rem', fontWeight:700, color:p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name?.includes('Revenue') ? fmt.currency(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { data: stats, loading } = useData(api.getStats);
  const { data: stData }         = useData(api.getStations);
  const stations = stData?.stations || [];
  const topStations = [...stations].sort((a,b) => parseFloat(b.platform_revenue||0) - parseFloat(a.platform_revenue||0)).slice(0,7);

  // Mock weekly trend (replace with real data later)
  const weeklyData = [
    { day:'Mon', bookings: 0, revenue: 0 },
    { day:'Tue', bookings: 0, revenue: 0 },
    { day:'Wed', bookings: 0, revenue: 0 },
    { day:'Thu', bookings: 0, revenue: 0 },
    { day:'Fri', bookings: 0, revenue: 0 },
    { day:'Sat', bookings: 0, revenue: 0 },
    { day:'Sun', bookings: 0, revenue: 0 },
  ];

  const pieData = stats ? [
    { name:'Completed', value: parseInt(stats.bookings?.completed||0), color: G },
    { name:'Active',    value: Math.max(0, parseInt(stats.bookings?.total||0) - parseInt(stats.bookings?.completed||0) - parseInt(stats.bookings?.pending||0)), color: B },
    { name:'Pending',   value: parseInt(stats.bookings?.pending||0),   color: A },
  ] : [];

  const porterPie = stats ? [
    { name:'Approved',  value: parseInt(stats.porters?.approved||0),  color: G },
    { name:'Online',    value: parseInt(stats.porters?.online||0),     color: B },
    { name:'Pending',   value: parseInt(stats.porters?.pending||0),    color: A },
    { name:'Suspended', value: parseInt(stats.porters?.suspended||0),  color: R },
  ] : [];

  const s = stats || {};

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #E5E7EB', borderTopColor: O, animation:'spin 0.8s linear infinite' }}/>
      <div style={{ color:'#6B7280', fontSize:'0.9rem' }}>Loading dashboard...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── ALERT STRIP ── */}
      {(parseInt(s.pendingFraudAlerts||0) > 0 || parseInt(s.openDisputes||0) > 0) && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 18px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.1rem' }}>⚠️</span>
          <span style={{ fontSize:'0.875rem', color:'#92400E', fontWeight:500 }}>
            <strong>{s.pendingFraudAlerts||0}</strong> fraud alert(s) and <strong>{s.openDisputes||0}</strong> open dispute(s) need attention
          </span>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <span style={{ fontSize:'0.75rem', background:'#F59E0B', color:'white', padding:'3px 10px', borderRadius:999, fontWeight:700, cursor:'pointer' }}>View Fraud</span>
            <span style={{ fontSize:'0.75rem', background:'#1B75BB', color:'white', padding:'3px 10px', borderRadius:999, fontWeight:700, cursor:'pointer' }}>View Disputes</span>
          </div>
        </div>
      )}

      {/* ── TOP STAT CARDS ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          {
            label:'Platform Revenue', icon:'💰', color: O,
            value: fmt.currency(s.revenue?.total||0),
            sub: `${fmt.currency(s.revenue?.today||0)} today`,
            bg:'#FFF4ED'
          },
          {
            label:'Total Bookings', icon:'📋', color: B,
            value: s.bookings?.total || '0',
            sub: `${s.bookings?.today||0} today`,
            bg:'#EBF4FC'
          },
          {
            label:'Active Porters', icon:'🔴', color: G,
            value: s.porters?.approved || '0',
            sub: `${s.porters?.online||0} online · ${s.porters?.pending||0} pending`,
            bg:'#DCFCE7'
          },
          {
            label:'Passengers', icon:'👤', color: A,
            value: s.users?.active || '0',
            sub: `${s.users?.banned||0} banned`,
            bg:'#FEF3C7'
          },
        ].map((card,i) => (
          <div key={i} style={{
            background:'white', borderRadius:16,
            border:'1px solid #F3F4F6',
            boxShadow:'0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
            padding:'20px', position:'relative', overflow:'hidden',
          }}>
            {/* Color accent top bar */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:card.color, borderRadius:'16px 16px 0 0' }}/>
            {/* Icon */}
            <div style={{ position:'absolute', top:16, right:16, width:42, height:42, borderRadius:10, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>
              {card.icon}
            </div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:8 }}>{card.label}</div>
            <div style={{ fontSize:'1.9rem', fontWeight:900, fontFamily:'Nunito,sans-serif', color:'#111827', margin:'8px 0 4px', lineHeight:1 }}>{card.value}</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── PLATFORM METRICS ROW ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {[
          { icon:'💳', label:'Normal fee', value:'15%', color: O },
          { icon:'🎉', label:'Festival fee', value:'25%', color: B },
          { icon:'⏱️', label:'Notify timer', value:'30 sec', color: G },
          { icon:'⚖️', label:'Dispute SLA', value:'2 hrs', color: A },
          { icon:'🚨', label:'Fraud threshold', value:'3 cancels', color: R },
        ].map((m,i) => (
          <div key={i} style={{ background:'white', borderRadius:12, border:'1px solid #F3F4F6', padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>{m.icon}</div>
            <div>
              <div style={{ fontSize:'0.68rem', color:'#9CA3AF', fontWeight:600 }}>{m.label}</div>
              <div style={{ fontSize:'1rem', fontWeight:800, fontFamily:'Nunito,sans-serif', color:m.color }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW 1 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16 }}>

        {/* Station revenue bar chart */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Station Revenue</div>
              <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:1 }}>Top performing stations</div>
            </div>
            <span style={{ fontSize:'0.72rem', background:'#FFF4ED', color:'#D4621A', padding:'4px 10px', borderRadius:999, fontWeight:700 }}>Platform fee ₹</span>
          </div>
          <div style={{ padding:'16px 12px 8px' }}>
            {topStations.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>🚉</div>
                <div style={{ fontSize:'0.875rem' }}>No station data yet</div>
                <div style={{ fontSize:'0.78rem', marginTop:4 }}>Add stations and start bookings</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topStations} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#9CA3AF' }} tickFormatter={v=>v.split(' ')[0]} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} tickFormatter={v=>`₹${v/1000}k`} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="platform_revenue" fill={O} radius={[6,6,0,0]} name="Revenue" maxBarSize={40}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Booking status pie */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Booking status</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:1 }}>All time breakdown</div>
          </div>
          <div style={{ padding:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={pieData.filter(p=>p.value>0)} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={2}>
                  {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v, n]}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              {pieData.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }}/>
                  <span style={{ fontSize:'0.75rem', color:'#6B7280' }}>{p.name}</span>
                  <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#374151' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 2 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Porter status */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Porter accounts</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:1 }}>Status breakdown</div>
          </div>
          <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'Approved & Active', value: s.porters?.approved||0, color:G, icon:'✅' },
              { label:'Online right now',  value: s.porters?.online||0,   color:B, icon:'🟢' },
              { label:'Pending approval',  value: s.porters?.pending||0,  color:A, icon:'⏳' },
              { label:'Suspended',         value: s.porters?.suspended||0,color:R, icon:'⊘' },
            ].map((item,i) => {
              const total = Math.max(1, parseInt(s.porters?.approved||0) + parseInt(s.porters?.pending||0) + parseInt(s.porters?.suspended||0));
              const pct = Math.round((parseInt(item.value)||0) / total * 100);
              return (
                <div key={i}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:'0.9rem' }}>{item.icon}</span>
                      <span style={{ fontSize:'0.82rem', color:'#374151', fontWeight:500 }}>{item.label}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:'0.78rem', color:'#9CA3AF' }}>{pct}%</span>
                      <span style={{ fontSize:'0.9rem', fontWeight:800, color:item.color, fontFamily:'Nunito,sans-serif', minWidth:24, textAlign:'right' }}>{item.value}</span>
                    </div>
                  </div>
                  <div style={{ height:5, background:'#F3F4F6', borderRadius:999, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:item.color, borderRadius:999, transition:'width 0.6s ease' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Quick actions</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:1 }}>Common tasks</div>
          </div>
          <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'✅', label:'Approve porters', sub:`${s.porters?.pending||0} waiting`, color:G, bg:'#DCFCE7' },
              { icon:'🚨', label:'Fraud alerts', sub:`${s.pendingFraudAlerts||0} unreviewed`, color:R, bg:'#FEE2E2' },
              { icon:'⚖️', label:'Disputes', sub:`${s.openDisputes||0} open`, color:B, bg:'#EBF4FC' },
              { icon:'💵', label:'Offline fees', sub:'Recovery pending', color:A, bg:'#FEF3C7' },
              { icon:'💹', label:'Surge pricing', sub:'Manage festivals', color:O, bg:'#FFF4ED' },
              { icon:'👁️', label:'Add viewer', sub:'Create account', color:'#7C3AED', bg:'#EDE9FE' },
            ].map((a,i) => (
              <div key={i} style={{ background:a.bg, borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'transform 0.15s', border:`1px solid ${a.bg}` }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{ fontSize:'1.2rem', marginBottom:5 }}>{a.icon}</div>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#111827' }}>{a.label}</div>
                <div style={{ fontSize:'0.72rem', color:a.color, fontWeight:600, marginTop:2 }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATION TABLE ── */}
      <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' }}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Station summary</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:1 }}>{stations.length} stations registered</div>
          </div>
          <span style={{ fontSize:'0.72rem', background:'#EBF4FC', color:'#1B75BB', padding:'4px 12px', borderRadius:999, fontWeight:700 }}>
            {stations.length} total
          </span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#FAFAFA' }}>
                {['Station','City Tier','Category','Porters','Bookings','Completed','Revenue'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF', fontSize:'0.875rem' }}>
                  No stations yet — add stations from the Stations page
                </td></tr>
              ) : stations.map((st,i) => (
                <tr key={i} style={{ borderTop:'1px solid #F9FAFB' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'#FFF4ED', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>🚉</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:'0.875rem', color:'#111827' }}>{st.name}</div>
                        <div style={{ fontSize:'0.72rem', color:'#9CA3AF' }}>{st.city}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'3px 10px', borderRadius:999, background: st.city_tier==='x'?'#FFF4ED':'#EBF4FC', color: st.city_tier==='x'?O:B }}>
                      Tier {st.city_tier?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'0.82rem', color:'#374151', fontWeight:600 }}>{st.category || 'A'}</td>
                  <td style={{ padding:'12px 16px', fontSize:'0.875rem', fontWeight:700, color:'#111827' }}>{st.total_porters||0}</td>
                  <td style={{ padding:'12px 16px', fontSize:'0.875rem', color:'#374151' }}>{st.total_bookings||0}</td>
                  <td style={{ padding:'12px 16px', fontSize:'0.875rem', color:'#374151' }}>{st.completed_bookings||0}</td>
                  <td style={{ padding:'12px 16px', fontSize:'0.875rem', fontWeight:800, color:O, fontFamily:'Nunito,sans-serif' }}>
                    {fmt.currency(st.platform_revenue||0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
