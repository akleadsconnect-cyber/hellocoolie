import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../components/shared';
import api from '../../services/api';

// ── Shared input style ─────────────────────────────────────
const inputStyle = {
  width:'100%', padding:'13px 14px 13px 42px',
  background:'rgba(255,255,255,0.05)',
  border:'1.5px solid rgba(255,255,255,0.1)',
  borderRadius:10, color:'white',
  fontSize:'0.9rem', fontFamily:'Inter, sans-serif',
  outline:'none', boxSizing:'border-box',
};
const labelStyle = {
  display:'block', color:'#94A3B8', fontSize:'0.78rem',
  fontWeight:600, marginBottom:7,
  textTransform:'uppercase', letterSpacing:'0.06em',
};
const iconWrap = { position:'relative' };
const iconSpan = {
  position:'absolute', left:14, top:'50%',
  transform:'translateY(-50%)', fontSize:'1rem', pointerEvents:'none',
};

// ── VIEWS ──────────────────────────────────────────────────
// login | forgot_step1 | forgot_step2 | forgot_step3

export default function LoginPage() {
  const { login } = useAuth();
  const [view,     setView]     = useState('login');
  const [role,     setRole]     = useState('admin');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  // Login fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Forgot password fields
  const [forgotId,      setForgotId]      = useState(''); // email or phone
  const [verifyField,   setVerifyField]   = useState(''); // aadhaar / dob / pan
  const [newPass,       setNewPass]       = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');

  const resetErr = () => setError('');

  // ── LOGIN ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); resetErr();
    const r = await login(email, password, role);
    setLoading(false);
    if (!r.ok) setError(r.error);
  };

  // ── FORGOT — Step 1: enter identifier + verification ────
  const handleForgotVerify = async (e) => {
    e.preventDefault();
    if (!forgotId || !verifyField) { setError('Fill all fields'); return; }
    setLoading(true); resetErr();
    // We verify identity directly on reset (no OTP for admin/viewer reset)
    // Just move to step 3 (new password)
    setLoading(false);
    setView('forgot_step3');
  };

  // ── FORGOT — Step 3: set new password ───────────────────
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
      toast('✅ Password reset successfully! Please login.', 'success');
      setView('login');
      setForgotId(''); setVerifyField(''); setNewPass(''); setConfirmPass('');
    } else {
      setError(r.error || 'Verification failed. Check your details.');
    }
  };

  // ── Labels based on role ─────────────────────────────────
  const verifyLabel = {
    admin:  'PAN Number (for identity verification)',
    viewer: 'PAN Number (for identity verification)',
  }[role] || 'PAN Number';

  const identifierLabel = {
    admin:  'Registered Email Address',
    viewer: 'Registered Email Address',
  }[role] || 'Email Address';

  const identifierPlaceholder = {
    admin:  'admin@hellocoolie.in',
    viewer: 'viewer@hellocoolie.in',
  }[role] || 'your@email.com';

  // ── LEFT PANEL (same for all views) ─────────────────────
  const LeftPanel = () => (
    <div style={{
      flex:'0 0 52%',
      background:'linear-gradient(145deg, #F47920 0%, #D4621A 40%, #1B75BB 100%)',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      padding:'48px', position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', top:-80, left:-80, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
      <div style={{ position:'absolute', bottom:-60, right:-60, width:250, height:250, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:6, background:'rgba(255,255,255,0.15)' }} />
      <div style={{ position:'absolute', bottom:18, left:0, right:0, height:3, background:'rgba(255,255,255,0.08)' }} />

      <div style={{ position:'relative', zIndex:1, textAlign:'center', marginBottom:32 }}>
        <div style={{ background:'white', borderRadius:24, padding:'16px 28px', display:'inline-block', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', marginBottom:24 }}>
          <img src="/logo.png" alt="HelloCoolie" style={{ height:64, objectFit:'contain' }} />
        </div>
        <h1 style={{ fontFamily:'Nunito,sans-serif', fontSize:'2.4rem', fontWeight:900, color:'white', margin:'0 0 8px', textShadow:'0 2px 12px rgba(0,0,0,0.2)' }}>
          India's First
        </h1>
        <h1 style={{ fontFamily:'Nunito,sans-serif', fontSize:'2.4rem', fontWeight:900, color:'rgba(255,255,255,0.9)', margin:'0 0 16px' }}>
          Porter Marketplace
        </h1>
        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'1.05rem', fontStyle:'italic', margin:0 }}>
          "Your Porter, Just a Hello Away!"
        </p>
      </div>

      <div style={{ display:'flex', gap:16, position:'relative', zIndex:1, flexWrap:'wrap', justifyContent:'center' }}>
        {[
          { val:'23 Cr+', label:'Daily Passengers' },
          { val:'1.5L+',  label:'Licensed Porters' },
          { val:'332+',   label:'Major Stations' },
        ].map((s,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', borderRadius:14, padding:'14px 20px', textAlign:'center', border:'1px solid rgba(255,255,255,0.2)', minWidth:100 }}>
            <div style={{ fontSize:'1.4rem', fontWeight:900, color:'white', fontFamily:'Nunito,sans-serif' }}>{s.val}</div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.8)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position:'absolute', bottom:28, left:0, right:0, textAlign:'center', zIndex:1, color:'rgba(255,255,255,0.6)', fontSize:'0.78rem' }}>
        🚉 Pan-India Railway Porter Booking Platform
      </div>
    </div>
  );

  // ── RIGHT PANEL wrapper ──────────────────────────────────
  const RightPanel = ({ children }) => (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', background:'#0B1120', overflowY:'auto' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {children}
      </div>
    </div>
  );

  // ── ROLE TOGGLE ──────────────────────────────────────────
  const RoleToggle = () => (
    <div style={{ display:'flex', gap:8, marginBottom:24, background:'rgba(255,255,255,0.05)', borderRadius:12, padding:4, border:'1px solid rgba(255,255,255,0.08)' }}>
      {[{id:'admin',icon:'👑',label:'Admin'},{id:'viewer',icon:'👁️',label:'Viewer'}].map(r => (
        <button key={r.id} onClick={() => { setRole(r.id); resetErr(); }} style={{
          flex:1, padding:'10px 16px', borderRadius:9, border:'none', cursor:'pointer',
          fontWeight:700, fontSize:'0.9rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s',
          background: role===r.id ? 'linear-gradient(135deg,#F47920,#D4621A)' : 'transparent',
          color: role===r.id ? 'white' : '#64748B',
          boxShadow: role===r.id ? '0 4px 15px rgba(244,121,32,0.3)' : 'none',
        }}>
          {r.icon} {r.label}
        </button>
      ))}
    </div>
  );

  // ── SUBMIT BUTTON ────────────────────────────────────────
  const SubmitBtn = ({ label }) => (
    <button type="submit" disabled={loading} style={{
      width:'100%', padding:'14px',
      background: loading ? '#64748B' : 'linear-gradient(135deg,#F47920 0%,#D4621A 100%)',
      border:'none', borderRadius:12, color:'white',
      fontSize:'1rem', fontWeight:700, fontFamily:'Nunito,sans-serif',
      cursor: loading ? 'not-allowed' : 'pointer',
      boxShadow: loading ? 'none' : '0 8px 25px rgba(244,121,32,0.35)',
      display:'flex', alignItems:'center', justifyContent:'center', gap:10,
    }}>
      {loading
        ? <><span style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Please wait...</>
        : label
      }
    </button>
  );

  // ── ERROR BOX ────────────────────────────────────────────
  const ErrBox = () => error ? (
    <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.25)', borderRadius:10, padding:'11px 14px', marginBottom:20, color:'#FCA5A5', fontSize:'0.875rem', display:'flex', gap:8, alignItems:'center' }}>
      ⚠️ {error}
    </div>
  ) : null;

  const focusStyle = (e) => e.target.style.borderColor = '#F47920';
  const blurStyle  = (e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)';

  // ════════════════════════════════════════════════════════
  // VIEW: LOGIN
  // ════════════════════════════════════════════════════════
  if (view === 'login') return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#0B1120', overflow:'hidden' }}>
      <LeftPanel />
      <RightPanel>
        <div style={{ marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(244,121,32,0.12)', border:'1px solid rgba(244,121,32,0.25)', borderRadius:999, padding:'5px 14px', marginBottom:20 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#F47920', display:'inline-block', boxShadow:'0 0 8px #F47920' }} />
            <span style={{ fontSize:'0.78rem', color:'#F47920', fontWeight:600 }}>Secure Portal</span>
          </div>
          <h2 style={{ color:'white', fontFamily:'Nunito,sans-serif', fontSize:'1.9rem', fontWeight:900, margin:'0 0 6px' }}>Welcome back 👋</h2>
          <p style={{ color:'#64748B', fontSize:'0.9rem', margin:0 }}>Sign in to manage HelloCoolie platform</p>
        </div>

        <RoleToggle />
        <ErrBox />

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:18 }}>
            <label style={labelStyle}>Email Address</label>
            <div style={iconWrap}>
              <span style={iconSpan}>📧</span>
              <input type="email" placeholder={identifierPlaceholder} value={email} onChange={e=>setEmail(e.target.value)} autoFocus style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Password</label>
            <div style={iconWrap}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)} style={{...inputStyle, paddingRight:42}} onFocus={focusStyle} onBlur={blurStyle} />
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', padding:4 }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign:'right', marginBottom:24 }}>
            <button type="button" onClick={() => { setView('forgot_step1'); resetErr(); setForgotId(email); }} style={{ background:'none', border:'none', color:'#F47920', fontSize:'0.82rem', cursor:'pointer', fontWeight:600, padding:0 }}>
              Forgot password?
            </button>
          </div>

          <SubmitBtn label={`Sign in as ${role==='admin'?'👑 Admin':'👁️ Viewer'} →`} />
        </form>

        <div style={{ marginTop:24, padding:'12px 16px', background:'rgba(27,117,187,0.08)', border:'1px solid rgba(27,117,187,0.2)', borderRadius:10, fontSize:'0.78rem', color:'#64748B', lineHeight:1.6 }}>
          🔒 This portal is for <span style={{ color:'#F47920', fontWeight:700 }}>Admin</span> and <span style={{ color:'#1B75BB', fontWeight:700 }}>Viewer</span> accounts only.<br />
          Porters & Passengers use the <span style={{ color:'white', fontWeight:600 }}>HelloCoolie mobile app</span>.
        </div>
        <p style={{ textAlign:'center', marginTop:20, fontSize:'0.72rem', color:'#334155' }}>HelloCoolie · "Your Porter, Just a Hello Away!"</p>
      </RightPanel>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:#475569} input:-webkit-autofill{-webkit-box-shadow:0 0 0 30px #0F1929 inset!important;-webkit-text-fill-color:white!important}`}</style>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // VIEW: FORGOT — Step 1 (identity verification)
  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step1') return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#0B1120', overflow:'hidden' }}>
      <LeftPanel />
      <RightPanel>
        <button onClick={()=>{setView('login');resetErr();}} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:'0.85rem', marginBottom:24, display:'flex', alignItems:'center', gap:6, padding:0 }}>
          ← Back to login
        </button>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'2rem', marginBottom:12 }}>🔑</div>
          <h2 style={{ color:'white', fontFamily:'Nunito,sans-serif', fontSize:'1.7rem', fontWeight:900, margin:'0 0 6px' }}>Reset Password</h2>
          <p style={{ color:'#64748B', fontSize:'0.875rem', margin:0 }}>
            Verify your identity to reset your password
          </p>
        </div>

        <RoleToggle />

        {/* What verification is needed per role */}
        <div style={{ background:'rgba(27,117,187,0.08)', border:'1px solid rgba(27,117,187,0.2)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:'0.8rem', color:'#93C5FD' }}>
          ℹ️ <strong>Admin & Viewer</strong> reset requires: Email + PAN Number
        </div>

        <ErrBox />

        <form onSubmit={handleForgotVerify}>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>{identifierLabel}</label>
            <div style={iconWrap}>
              <span style={iconSpan}>📧</span>
              <input type="email" placeholder={identifierPlaceholder} value={forgotId} onChange={e=>setForgotId(e.target.value)} autoFocus style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={labelStyle}>{verifyLabel}</label>
            <div style={iconWrap}>
              <span style={iconSpan}>🪪</span>
              <input type="text" placeholder="e.g. ABCDE1234F" value={verifyField} onChange={e=>setVerifyField(e.target.value.toUpperCase())} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          <SubmitBtn label="Verify Identity →" />
        </form>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:#475569}`}</style>
      </RightPanel>
    </div>
  );

  // ════════════════════════════════════════════════════════
  // VIEW: FORGOT — Step 3 (set new password)
  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step3') return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#0B1120', overflow:'hidden' }}>
      <LeftPanel />
      <RightPanel>
        <button onClick={()=>{setView('forgot_step1');resetErr();}} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:'0.85rem', marginBottom:24, display:'flex', alignItems:'center', gap:6, padding:0 }}>
          ← Back
        </button>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:'2rem', marginBottom:12 }}>🔐</div>
          <h2 style={{ color:'white', fontFamily:'Nunito,sans-serif', fontSize:'1.7rem', fontWeight:900, margin:'0 0 6px' }}>Set New Password</h2>
          <p style={{ color:'#64748B', fontSize:'0.875rem', margin:0 }}>
            Choose a strong new password for <span style={{ color:'#F47920' }}>{forgotId}</span>
          </p>
        </div>

        <ErrBox />

        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>New Password</label>
            <div style={iconWrap}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Minimum 6 characters" value={newPass} onChange={e=>setNewPass(e.target.value)} autoFocus style={{...inputStyle, paddingRight:42}} onFocus={focusStyle} onBlur={blurStyle} />
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', padding:4 }}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Confirm New Password</label>
            <div style={iconWrap}>
              <span style={iconSpan}>🔒</span>
              <input type={showPass?'text':'password'} placeholder="Re-enter new password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>

          {/* Password strength */}
          {newPass && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex:1, height:3, borderRadius:999,
                    background: newPass.length >= i*2
                      ? i<=1 ? '#DC2626' : i<=2 ? '#D97706' : i<=3 ? '#F47920' : '#16A34A'
                      : 'rgba(255,255,255,0.1)',
                    transition:'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize:'0.72rem', color:'#64748B' }}>
                {newPass.length < 6 ? '⚠️ Too short' : newPass.length < 8 ? '😐 Weak' : newPass.length < 12 ? '👍 Good' : '💪 Strong'}
              </div>
            </div>
          )}

          {/* Match indicator */}
          {confirmPass && (
            <div style={{ marginBottom:20, fontSize:'0.78rem', color: newPass===confirmPass ? '#16A34A' : '#DC2626' }}>
              {newPass===confirmPass ? '✅ Passwords match' : '❌ Passwords do not match'}
            </div>
          )}

          <SubmitBtn label="Reset Password →" />
        </form>

        <div style={{ marginTop:20, padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:10, fontSize:'0.78rem', color:'#475569' }}>
          💡 After reset, you'll be redirected to login with your new password.
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:#475569}`}</style>
      </RightPanel>
    </div>
  );

  return null;
}
