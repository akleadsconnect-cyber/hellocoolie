import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../components/shared';
import api from '../../services/api';

// Fetch stats ONCE outside component to avoid re-render loops
let cachedStats = null;
const fetchStats = async () => {
  if (cachedStats) return cachedStats;
  const r = await api.getStats();
  if (r.ok) { cachedStats = r.data; return r.data; }
  return null;
};

const labelStyle = {
  display:'block', color:'#374151', fontSize:'0.78rem',
  fontWeight:700, marginBottom:7,
  textTransform:'uppercase', letterSpacing:'0.06em',
};
const inputStyle = {
  width:'100%', padding:'13px 14px 13px 42px',
  background:'#F9FAFB', border:'1.5px solid #E5E7EB',
  borderRadius:10, color:'#111827',
  fontSize:'0.9rem', fontFamily:'Inter,sans-serif',
  outline:'none', boxSizing:'border-box', transition:'border-color 0.15s',
};
const iconSpan = {
  position:'absolute', left:14, top:'50%',
  transform:'translateY(-50%)', fontSize:'1rem', pointerEvents:'none',
};

export default function LoginPage() {
  const { login }  = useAuth();
  const [view,     setView]     = useState('login');
  const [role,     setRole]     = useState('admin');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  // Login
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Forgot
  const [forgotId,    setForgotId]    = useState('');
  const [verifyField, setVerifyField] = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Live stats from API — fetched once, no re-render loop
  const [stats, setStats] = useState(cachedStats);

  useEffect(() => {
    if (!cachedStats) {
      fetchStats().then(data => {
        if (data) setStats(data);
      });
    }
  }, []); // empty deps — only runs once

  const resetErr = () => setError('');
  const focusIn  = e => e.target.style.borderColor = '#F47920';
  const focusOut = e => e.target.style.borderColor = '#E5E7EB';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); resetErr();
    const r = await login(email, password, role);
    setLoading(false);
    if (!r.ok) setError(r.error);
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    if (!forgotId || !verifyField) { setError('Fill all fields'); return; }
    setLoading(true); resetErr();
    await new Promise(r => setTimeout(r, 500));
    setLoading(false);
    setView('forgot_step3');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPass || !confirmPass) { setError('Fill all fields'); return; }
    if (newPass.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPass !== confirmPass) { setError('Passwords do not match'); return; }
    setLoading(true); resetErr();
    const r = await api.req('POST', '/auth/reset-password', {
      identifier: forgotId,
      new_password: newPass,
      role,
      verification_field: verifyField,
    });
    setLoading(false);
    if (r.ok) {
      toast('✅ Password reset! Please login.', 'success');
      setView('login');
      setForgotId(''); setVerifyField(''); setNewPass(''); setConfirmPass('');
    } else {
      setError(r.error || 'Verification failed. Check your details.');
    }
  };

  // ── Shared components ────────────────────────────────────
  const ErrBox = () => error ? (
    <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 14px', marginBottom:20, color:'#DC2626', fontSize:'0.875rem', display:'flex', gap:8, alignItems:'center' }}>
      ⚠️ {error}
    </div>
  ) : null;

  const RoleToggle = () => (
    <div style={{ display:'flex', gap:6, marginBottom:24, background:'#F3F4F6', borderRadius:12, padding:4 }}>
      {[{id:'admin',icon:'👑',label:'Admin'},{id:'viewer',icon:'👁️',label:'Viewer'}].map(r => (
        <button key={r.id} onClick={() => { setRole(r.id); resetErr(); }} style={{
          flex:1, padding:'10px 16px', borderRadius:9, border:'none', cursor:'pointer',
          fontWeight:700, fontSize:'0.9rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s',
          background: role===r.id ? 'linear-gradient(135deg,#F47920,#D4621A)' : 'transparent',
          color: role===r.id ? 'white' : '#6B7280',
          boxShadow: role===r.id ? '0 4px 12px rgba(244,121,32,0.3)' : 'none',
        }}>
          {r.icon} {r.label}
        </button>
      ))}
    </div>
  );

  const SubmitBtn = ({ label }) => (
    <button type="submit" disabled={loading} style={{
      width:'100%', padding:'14px',
      background: loading ? '#9CA3AF' : 'linear-gradient(135deg,#F47920,#D4621A)',
      border:'none', borderRadius:12, color:'white',
      fontSize:'1rem', fontWeight:700, fontFamily:'Nunito,sans-serif',
      cursor: loading ? 'not-allowed' : 'pointer',
      boxShadow: loading ? 'none' : '0 6px 20px rgba(244,121,32,0.35)',
      display:'flex', alignItems:'center', justifyContent:'center', gap:10,
      transition:'all 0.2s',
    }}>
      {loading
        ? <><span style={{ width:18,height:18,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite' }}/> Please wait...</>
        : label}
    </button>
  );

  // ── LEFT PANEL ───────────────────────────────────────────
  const LeftPanel = () => (
    <div style={{
      flex:'0 0 50%',
      background:'linear-gradient(150deg, #F47920 0%, #E8390E 45%, #1B75BB 100%)',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'48px 40px', position:'relative', overflow:'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{ position:'absolute',top:-100,left:-100,width:350,height:350,borderRadius:'50%',background:'rgba(255,255,255,0.06)' }}/>
      <div style={{ position:'absolute',bottom:-80,right:-80,width:280,height:280,borderRadius:'50%',background:'rgba(255,255,255,0.05)' }}/>
      <div style={{ position:'absolute',top:'55%',right:-50,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,0.04)' }}/>

      {/* Logo */}
      <div style={{ position:'relative',zIndex:1,textAlign:'center',marginBottom:36 }}>
        <div style={{ background:'white',borderRadius:24,padding:'18px 32px',display:'inline-block',boxShadow:'0 24px 64px rgba(0,0,0,0.2)',marginBottom:28 }}>
          <img src="/logo.png" alt="HelloCoolie" style={{ height:68,objectFit:'contain' }}/>
        </div>
        <h1 style={{ fontFamily:'Nunito,sans-serif',fontSize:'2.6rem',fontWeight:900,color:'white',margin:'0 0 4px',lineHeight:1.2 }}>
          India's First
        </h1>
        <h1 style={{ fontFamily:'Nunito,sans-serif',fontSize:'2.6rem',fontWeight:900,color:'rgba(255,255,255,0.92)',margin:'0 0 18px',lineHeight:1.2 }}>
          Porter Marketplace
        </h1>
        <p style={{ color:'rgba(255,255,255,0.85)',fontSize:'1.1rem',fontStyle:'italic',margin:0 }}>
          "Your Porter, Just a Hello Away!"
        </p>
      </div>

      {/* LIVE stats from API */}
      <div style={{ display:'flex',gap:14,position:'relative',zIndex:1,flexWrap:'wrap',justifyContent:'center',width:'100%' }}>
        {(stats ? [
          { val: `₹${Number(stats.revenue?.total||0).toLocaleString('en-IN')}`, label:'Platform Revenue' },
          { val: stats.bookings?.total || '0',                                   label:'Total Bookings' },
          { val: stats.porters?.approved || '0',                                 label:'Active Porters' },
          { val: stats.users?.active || '0',                                     label:'Passengers' },
        ] : [
          { val:'—', label:'Platform Revenue' },
          { val:'—', label:'Total Bookings' },
          { val:'—', label:'Active Porters' },
          { val:'—', label:'Passengers' },
        ]).map((statItem,i) => (
          <div key={i} style={{
            background:'rgba(255,255,255,0.15)',
            backdropFilter:'blur(10px)',
            borderRadius:14, padding:'14px 18px',
            textAlign:'center',
            border:'1px solid rgba(255,255,255,0.22)',
            minWidth:'calc(50% - 7px)', flex:'1 1 calc(50% - 7px)',
          }}>
            <div style={{ fontSize:'1.5rem',fontWeight:900,color:'white',fontFamily:'Nunito,sans-serif',lineHeight:1 }}>
              {statItem.val}
            </div>
            <div style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.8)',marginTop:5,fontWeight:500 }}>
              {statItem.label}
            </div>
            {stats && <div style={{ width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,0.6)',margin:'6px auto 0',boxShadow:'0 0 6px rgba(255,255,255,0.8)' }}/>}
          </div>
        ))}
      </div>

      {stats && (
        <div style={{ position:'relative',zIndex:1,marginTop:16,display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ width:7,height:7,borderRadius:'50%',background:'#4ADE80',display:'inline-block',boxShadow:'0 0 8px #4ADE80',animation:'pulse 2s infinite' }}/>
          <span style={{ fontSize:'0.75rem',color:'rgba(255,255,255,0.7)',fontWeight:600 }}>Live data from platform</span>
        </div>
      )}

      <div style={{ position:'absolute',bottom:24,left:0,right:0,textAlign:'center',zIndex:1,color:'rgba(255,255,255,0.55)',fontSize:'0.78rem' }}>
        🚉 Pan-India Railway Porter Booking Platform
      </div>
    </div>
  );

  // ── RIGHT PANEL ──────────────────────────────────────────
  const RightPanel = ({ children }) => (
    <div style={{
      flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      padding:'40px', background:'white', overflowY:'auto',
    }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {children}
      </div>
    </div>
  );

  const BackBtn = ({ to }) => (
    <button onClick={()=>{setView(to);resetErr();}} style={{ background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:'0.85rem',marginBottom:24,display:'flex',alignItems:'center',gap:6,padding:0,fontWeight:600 }}>
      ← Back
    </button>
  );

  // ════════════════════════════════════════════════════════
  // LOGIN VIEW
  // ════════════════════════════════════════════════════════
  if (view === 'login') return (
    <div style={{ minHeight:'100vh',display:'flex',overflow:'hidden' }}>
      <LeftPanel/>
      <RightPanel>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'#FFF4ED',border:'1px solid #FFD4B0',borderRadius:999,padding:'5px 14px',marginBottom:18 }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'#F47920',display:'inline-block',boxShadow:'0 0 6px #F47920' }}/>
            <span style={{ fontSize:'0.78rem',color:'#D4621A',fontWeight:700 }}>Secure Admin Portal</span>
          </div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'2rem',fontWeight:900,margin:'0 0 6px' }}>Welcome back 👋</h2>
          <p style={{ color:'#6B7280',fontSize:'0.9rem',margin:0 }}>Sign in to manage the HelloCoolie platform</p>
        </div>

        <RoleToggle/>
        <ErrBox/>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>📧</span>
              <input type="email" placeholder={role==='admin'?'admin@hellocoolie.in':'viewer@hellocoolie.in'}
                value={email} onChange={e=>setEmail(e.target.value)}
                autoComplete="email"
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
            </div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Your password"
                value={password} onChange={e=>setPassword(e.target.value)}
                autoComplete="current-password"
                style={{...inputStyle,paddingRight:44}} onFocus={focusIn} onBlur={focusOut}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',padding:4,color:'#9CA3AF' }}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>

          <div style={{ textAlign:'right',marginBottom:22 }}>
            <button type="button" onClick={()=>{setView('forgot_step1');resetErr();setForgotId(email);}} style={{ background:'none',border:'none',color:'#F47920',fontSize:'0.82rem',cursor:'pointer',fontWeight:700,padding:0 }}>
              Forgot password?
            </button>
          </div>

          <SubmitBtn label={`Sign in as ${role==='admin'?'👑 Admin':'👁️ Viewer'} →`}/>
        </form>

        <div style={{ marginTop:20,padding:'12px 16px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,fontSize:'0.78rem',color:'#3B82F6',lineHeight:1.7 }}>
          🔒 This portal is for <strong style={{color:'#F47920'}}>Admin</strong> and <strong style={{color:'#1B75BB'}}>Viewer</strong> accounts only.<br/>
          Porters & Passengers use the <strong>HelloCoolie mobile app</strong>.
        </div>

        <p style={{ textAlign:'center',marginTop:20,fontSize:'0.72rem',color:'#9CA3AF' }}>HelloCoolie · "Your Porter, Just a Hello Away!"</p>
      </RightPanel>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // FORGOT STEP 1
  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step1') return (
    <div style={{ minHeight:'100vh',display:'flex',overflow:'hidden' }}>
      <LeftPanel/>
      <RightPanel>
        <BackBtn to="login"/>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'2.5rem',marginBottom:12 }}>🔑</div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'1.8rem',fontWeight:900,margin:'0 0 6px' }}>Reset Password</h2>
          <p style={{ color:'#6B7280',fontSize:'0.875rem',margin:0 }}>Verify your identity to reset your password</p>
        </div>

        <RoleToggle/>

        <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px 14px',marginBottom:20,fontSize:'0.8rem',color:'#1D4ED8',lineHeight:1.6 }}>
          ℹ️ <strong>Admin & Viewer</strong>: Enter your registered email + PAN number to verify identity
        </div>

        <ErrBox/>
        <form onSubmit={handleForgotVerify}>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Registered Email Address</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>📧</span>
              <input type="email" placeholder={role==='admin'?'admin@hellocoolie.in':'viewer@hellocoolie.in'}
                value={forgotId} onChange={e=>setForgotId(e.target.value)} autoFocus
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
            </div>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={labelStyle}>PAN Number (Identity Verification)</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>🪪</span>
              <input type="text" placeholder="e.g. ABCDE1234F"
                value={verifyField} onChange={e=>setVerifyField(e.target.value.toUpperCase())}
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
            </div>
          </div>
          <SubmitBtn label="Verify Identity →"/>
        </form>
      </RightPanel>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // FORGOT STEP 3 — new password
  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step3') return (
    <div style={{ minHeight:'100vh',display:'flex',overflow:'hidden' }}>
      <LeftPanel/>
      <RightPanel>
        <BackBtn to="forgot_step1"/>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'2.5rem',marginBottom:12 }}>🔐</div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'1.8rem',fontWeight:900,margin:'0 0 6px' }}>Set New Password</h2>
          <p style={{ color:'#6B7280',fontSize:'0.875rem',margin:0 }}>
            New password for <span style={{ color:'#F47920',fontWeight:700 }}>{forgotId}</span>
          </p>
        </div>
        <ErrBox/>
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>New Password</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Minimum 6 characters"
                value={newPass} onChange={e=>setNewPass(e.target.value)} autoFocus
                style={{...inputStyle,paddingRight:44}} onFocus={focusIn} onBlur={focusOut}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',padding:4 }}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>

          {/* Strength bar */}
          {newPass && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex',gap:4,marginBottom:4 }}>
                {[1,2,3,4].map(i=>(
                  <div key={i} style={{ flex:1,height:4,borderRadius:999,transition:'background 0.2s',
                    background:newPass.length>=i*2
                      ?i<=1?'#EF4444':i<=2?'#F59E0B':i<=3?'#F47920':'#10B981'
                      :'#E5E7EB' }}/>
                ))}
              </div>
              <div style={{ fontSize:'0.72rem',color:'#6B7280' }}>
                {newPass.length<6?'⚠️ Too short':newPass.length<8?'😐 Weak':newPass.length<12?'👍 Good':'💪 Strong'}
              </div>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Confirm New Password</label>
            <div style={{ position:'relative' }}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Re-enter new password"
                value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}
                style={inputStyle} onFocus={focusIn} onBlur={focusOut}/>
            </div>
          </div>

          {confirmPass && (
            <div style={{ marginBottom:16,fontSize:'0.82rem',fontWeight:600,color:newPass===confirmPass?'#10B981':'#EF4444' }}>
              {newPass===confirmPass?'✅ Passwords match':'❌ Passwords do not match'}
            </div>
          )}

          <SubmitBtn label="Reset Password →"/>
        </form>
        <div style={{ marginTop:16,padding:'12px 14px',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:10,fontSize:'0.78rem',color:'#6B7280' }}>
          💡 After reset you'll be redirected to login with your new password.
        </div>
      </RightPanel>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  return null;
}
