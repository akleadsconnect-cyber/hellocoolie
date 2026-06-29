import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { fmt } from '../../components/shared';
import { useData } from '../../hooks/useAuth';
import api from '../../services/api';

const O='#F47920', B='#1B75BB', G='#16A34A', A='#D97706', R='#DC2626';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'white', border:'1px solid #E5E7EB', borderRadius:8, padding:'8px 12px' }}>
      <div style={{ fontSize:'0.75rem', color:'#6B7280', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ fontSize:'0.875rem', fontWeight:700, color:p.color }}>
          {fmt.currency(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { data: statsData, loading: sLoad } = useData(api.getStats);
  const { data: stData }                    = useData(api.getStations);

  // ALL variables declared at top — no conditional before these
  const stats    = statsData || {};
  const stations = stData?.stations || [];
  const rev      = stats.revenue    || {};
  const bk       = stats.bookings   || {};
  const pt       = stats.porters    || {};
  const usr      = stats.users      || {};

  const topStations = [...stations]
    .sort((a,b) => parseFloat(b.platform_revenue||0) - parseFloat(a.platform_revenue||0))
    .slice(0,7);

  const pieData = [
    { name:'Completed', value: parseInt(bk.completed||0), color:G },
    { name:'Active',    value: Math.max(0, parseInt(bk.total||0) - parseInt(bk.completed||0) - parseInt(bk.pending||0)), color:B },
    { name:'Pending',   value: parseInt(bk.pending||0),   color:A },
  ].filter(p => p.value > 0);

  const porterBars = [
    { label:'Approved',  value: parseInt(pt.approved||0),  color:G, icon:'✅' },
    { label:'Online now',value: parseInt(pt.online||0),    color:B, icon:'🟢' },
    { label:'Pending',   value: parseInt(pt.pending||0),   color:A, icon:'⏳' },
    { label:'Suspended', value: parseInt(pt.suspended||0), color:R, icon:'⊘'  },
  ];
  const ptTotal = Math.max(1, parseInt(pt.approved||0) + parseInt(pt.pending||0) + parseInt(pt.suspended||0));

  // NOW we can conditionally render
  if (sLoad) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #E5E7EB', borderTopColor:O, animation:'spin 0.8s linear infinite' }}/>
      <div style={{ color:'#6B7280', fontSize:'0.9rem' }}>Loading dashboard...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Alert strip */}
      {(parseInt(stats.pendingFraudAlerts||0) > 0 || parseInt(stats.openDisputes||0) > 0) && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 18px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.1rem' }}>⚠️</span>
          <span style={{ fontSize:'0.875rem', color:'#92400E', fontWeight:500 }}>
            <strong>{stats.pendingFraudAlerts||0}</strong> fraud alert(s) and <strong>{stats.openDisputes||0}</strong> dispute(s) need attention
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          { label:'Platform Revenue', icon:'💰', color:O, bg:'#FFF4ED', value:fmt.currency(rev.total||0), sub:`${fmt.currency(rev.today||0)} today` },
          { label:'Total Bookings',   icon:'📋', color:B, bg:'#EBF4FC', value:bk.total||'0',              sub:`${bk.today||0} today` },
          { label:'Active Porters',   icon:'🔴', color:G, bg:'#DCFCE7', value:pt.approved||'0',           sub:`${pt.online||0} online · ${pt.pending||0} pending` },
          { label:'Passengers',       icon:'👤', color:A, bg:'#FEF3C7', value:usr.active||'0',            sub:`${usr.banned||0} banned` },
        ].map((card,i) => (
          <div key={i} style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:'20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:card.color, borderRadius:'16px 16px 0 0' }}/>
            <div style={{ position:'absolute', top:16, right:16, width:42, height:42, borderRadius:10, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{card.icon}</div>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:8 }}>{card.label}</div>
            <div style={{ fontSize:'1.9rem', fontWeight:900, fontFamily:'Nunito,sans-serif', color:'#111827', margin:'8px 0 4px', lineHeight:1 }}>{card.value}</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Platform metrics strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {[
          { icon:'💳', label:'Normal fee',       value:'15%',       color:O },
          { icon:'🎉', label:'Festival fee',     value:'25%',       color:B },
          { icon:'⏱️', label:'Notify timer',     value:'30 sec',    color:G },
          { icon:'⚖️', label:'Dispute SLA',      value:'2 hrs',     color:A },
          { icon:'🚨', label:'Fraud threshold',  value:'3 cancels', color:R },
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

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16 }}>

        {/* Station revenue */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Station revenue</div>
              <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>Top performing stations</div>
            </div>
            <span style={{ fontSize:'0.72rem', background:'#FFF4ED', color:'#D4621A', padding:'4px 10px', borderRadius:999, fontWeight:700 }}>Platform fee ₹</span>
          </div>
          <div style={{ padding:'16px 12px 8px' }}>
            {topStations.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>🚉</div>
                <div style={{ fontSize:'0.875rem' }}>No station data yet</div>
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

        {/* Booking pie */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Booking status</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>All time breakdown</div>
          </div>
          <div style={{ padding:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={2}>
                  {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[v,n]}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              {pieData.map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }}/>
                  <span style={{ fontSize:'0.75rem', color:'#6B7280' }}>{p.name}</span>
                  <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#374151' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Porter + Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Porter progress bars */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Porter accounts</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>Status breakdown</div>
          </div>
          <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
            {porterBars.map((item,i) => {
              const pct = Math.round((item.value / ptTotal) * 100);
              return (
                <div key={i}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:'0.9rem' }}>{item.icon}</span>
                      <span style={{ fontSize:'0.82rem', color:'#374151', fontWeight:500 }}>{item.label}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:'0.78rem', color:'#9CA3AF' }}>{pct}%</span>
                      <span style={{ fontSize:'0.95rem', fontWeight:800, color:item.color, fontFamily:'Nunito,sans-serif', minWidth:24, textAlign:'right' }}>{item.value}</span>
                    </div>
                  </div>
                  <div style={{ height:6, background:'#F3F4F6', borderRadius:999, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:item.color, borderRadius:999 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid #F9FAFB' }}>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Quick actions</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>Common tasks</div>
          </div>
          <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { icon:'✅', label:'Approve porters',  sub:`${pt.pending||0} waiting`,           color:G, bg:'#DCFCE7' },
              { icon:'🚨', label:'Fraud alerts',     sub:`${stats.pendingFraudAlerts||0} unreviewed`, color:R, bg:'#FEE2E2' },
              { icon:'⚖️', label:'Disputes',         sub:`${stats.openDisputes||0} open`,       color:B, bg:'#EBF4FC' },
              { icon:'💵', label:'Offline fees',     sub:'Recovery pending',                    color:A, bg:'#FEF3C7' },
              { icon:'💹', label:'Surge pricing',    sub:'Manage festivals',                    color:O, bg:'#FFF4ED' },
              { icon:'👁️', label:'Add viewer',      sub:'Create account',                      color:'#7C3AED', bg:'#EDE9FE' },
            ].map((a,i) => (
              <div key={i} style={{ background:a.bg, borderRadius:10, padding:'12px 14px', cursor:'pointer' }}>
                <div style={{ fontSize:'1.2rem', marginBottom:5 }}>{a.icon}</div>
                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#111827' }}>{a.label}</div>
                <div style={{ fontSize:'0.72rem', color:a.color, fontWeight:600, marginTop:2 }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Station table */}
      <div style={{ background:'white', borderRadius:16, border:'1px solid #F3F4F6', overflow:'hidden' }}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid #F9FAFB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#111827', fontFamily:'Nunito,sans-serif' }}>Station summary</div>
            <div style={{ fontSize:'0.75rem', color:'#9CA3AF' }}>{stations.length} stations registered</div>
          </div>
          <span style={{ fontSize:'0.72rem', background:'#EBF4FC', color:B, padding:'4px 12px', borderRadius:999, fontWeight:700 }}>{stations.length} total</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#FAFAFA' }}>
                {['Station','Tier','Porters','Bookings','Completed','Revenue'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.68rem', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:'48px', color:'#9CA3AF', fontSize:'0.875rem' }}>No stations yet</td></tr>
              ) : stations.map((st,i) => (
                <tr key={i} style={{ borderTop:'1px solid #F9FAFB' }}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'#FFF4ED', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🚉</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:'0.875rem', color:'#111827' }}>{st.name}</div>
                        <div style={{ fontSize:'0.72rem', color:'#9CA3AF' }}>{st.city}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'3px 10px', borderRadius:999, background:st.city_tier==='x'?'#FFF4ED':'#EBF4FC', color:st.city_tier==='x'?O:B }}>
                      Tier {(st.city_tier||'y').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', fontWeight:700 }}>{st.total_porters||0}</td>
                  <td style={{ padding:'12px 16px', color:'#374151' }}>{st.total_bookings||0}</td>
                  <td style={{ padding:'12px 16px', color:'#374151' }}>{st.completed_bookings||0}</td>
                  <td style={{ padding:'12px 16px', fontWeight:800, color:O, fontFamily:'Nunito,sans-serif' }}>{fmt.currency(st.platform_revenue||0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
