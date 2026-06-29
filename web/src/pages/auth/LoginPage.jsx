import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

let cachedStats = null;

export default function LoginPage() {
  const { login } = useAuth();
  const [view,    setView]    = useState('login');
  const [role,    setRole]    = useState('admin');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass,setShowPass]= useState(false);
  const [stats,   setStats]   = useState(null);

  // Use uncontrolled inputs — NO value/onChange on inputs
  const emailRef    = useRef();
  const passRef     = useRef();
  const forgotIdRef = useRef();
  const verifyRef   = useRef();
  const newPassRef  = useRef();
  const confPassRef = useRef();

  useEffect(() => {
    if (!cachedStats) {
      api.getStats().then(r => {
        if (r.ok) { cachedStats = r.data; setStats(r.data); }
      });
    } else {
      setStats(cachedStats);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email    = emailRef.current?.value?.trim();
    const password = passRef.current?.value;
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); setError('');
    const r = await login(email, password, role);
    setLoading(false);
    if (!r.ok) setError(r.error);
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    const id     = forgotIdRef.current?.value?.trim();
    const verify = verifyRef.current?.value?.trim();
    if (!id || !verify) { setError('Fill all fields'); return; }
    setError('');
    setView('forgot_step3');
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const np = newPassRef.current?.value;
    const cp = confPassRef.current?.value;
    if (!np || !cp) { setError('Fill all fields'); return; }
    if (np.length < 6) { setError('Min 6 characters'); return; }
    if (np !== cp) { setError('Passwords do not match'); return; }
    const id     = forgotIdRef.current?.value?.trim();
    const verify = verifyRef.current?.value?.trim();
    setLoading(true); setError('');
    const r = await api.req('POST', '/auth/reset-password', {
      identifier: id, new_password: np, role, verification_field: verify,
    });
    setLoading(false);
    if (r.ok) { setView('login'); setError(''); }
    else setError(r.error || 'Verification failed');
  };

  // ── Styles ───────────────────────────────────────────────
  const inp = {
    display:'block', width:'100%', padding:'12px 14px 12px 40px',
    border:'1.5px solid #E5E7EB', borderRadius:10,
    fontSize:'0.9rem', color:'#111827', background:'#F9FAFB',
    fontFamily:'Inter,sans-serif', boxSizing:'border-box',
    outline:'none',
  };
  const inpPass = { ...inp, paddingRight:44 };
  const lbl = {
    display:'block', fontSize:'0.72rem', fontWeight:700,
    color:'#374151', textTransform:'uppercase',
    letterSpacing:'0.07em', marginBottom:6,
  };

  // ── Left panel ───────────────────────────────────────────
  const Left = () => (
    <div style={{ flex:'0 0 50%', background:'linear-gradient(150deg,#F47920 0%,#E8390E 45%,#1B75BB 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute',top:-80,left:-80,width:300,height:300,borderRadius:'50%',background:'rgba(255,255,255,0.06)' }}/>
      <div style={{ position:'absolute',bottom:-60,right:-60,width:260,height:260,borderRadius:'50%',background:'rgba(255,255,255,0.05)' }}/>
      <div style={{ position:'relative',zIndex:1,textAlign:'center',marginBottom:32 }}>
        <div style={{ background:'white',borderRadius:20,padding:'16px 28px',display:'inline-block',boxShadow:'0 20px 50px rgba(0,0,0,0.2)',marginBottom:24 }}>
          <img src="/logo.png" alt="HelloCoolie" style={{ height:60,objectFit:'contain' }}/>
        </div>
        <h1 style={{ fontFamily:'Nunito,sans-serif',fontSize:'2.4rem',fontWeight:900,color:'white',margin:'0 0 4px' }}>India's First</h1>
        <h1 style={{ fontFamily:'Nunito,sans-serif',fontSize:'2.4rem',fontWeight:900,color:'rgba(255,255,255,0.9)',margin:'0 0 14px' }}>Porter Marketplace</h1>
        <p style={{ color:'rgba(255,255,255,0.85)',fontSize:'1rem',fontStyle:'italic',margin:0 }}>"Your Porter, Just a Hello Away!"</p>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,width:'100%',maxWidth:340,position:'relative',zIndex:1 }}>
        {(stats ? [
          { val:`₹${Number(stats.revenue?.total||0).toLocaleString('en-IN')}`, label:'Platform Revenue' },
          { val:stats.bookings?.total||'0',    label:'Total Bookings' },
          { val:stats.porters?.approved||'0',  label:'Active Porters' },
          { val:stats.users?.active||'0',      label:'Passengers' },
        ] : [
          { val:'—',label:'Platform Revenue' },
          { val:'—',label:'Total Bookings' },
          { val:'—',label:'Active Porters' },
          { val:'—',label:'Passengers' },
        ]).map((s,i)=>(
          <div key={i} style={{ background:'rgba(255,255,255,0.15)',borderRadius:12,padding:'12px 16px',border:'1px solid rgba(255,255,255,0.2)',textAlign:'center' }}>
            <div style={{ fontSize:'1.3rem',fontWeight:900,color:'white',fontFamily:'Nunito,sans-serif' }}>{s.val}</div>
            <div style={{ fontSize:'0.7rem',color:'rgba(255,255,255,0.8)',marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {stats && (
        <div style={{ position:'relative',zIndex:1,marginTop:14,display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ width:7,height:7,borderRadius:'50%',background:'#4ADE80',display:'inline-block' }}/>
          <span style={{ fontSize:'0.72rem',color:'rgba(255,255,255,0.7)' }}>Live platform data</span>
        </div>
      )}
      <div style={{ position:'absolute',bottom:20,color:'rgba(255,255,255,0.5)',fontSize:'0.75rem' }}>🚉 Pan-India Railway Porter Booking Platform</div>
    </div>
  );

  const Right = ({children}) => (
    <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px',background:'white',overflowY:'auto' }}>
      <div style={{ width:'100%',maxWidth:400 }}>{children}</div>
    </div>
  );

  const RoleToggle = () => (
    <div style={{ display:'flex',gap:6,marginBottom:22,background:'#F3F4F6',borderRadius:12,padding:4 }}>
      {[{id:'admin',icon:'👑',label:'Admin'},{id:'viewer',icon:'👁️',label:'Viewer'}].map(r=>(
        <button key={r.id} type="button" onClick={()=>{setRole(r.id);setError('');}} style={{
          flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',
          fontWeight:700,fontSize:'0.9rem',fontFamily:'Inter,sans-serif',
          background:role===r.id?'linear-gradient(135deg,#F47920,#D4621A)':'transparent',
          color:role===r.id?'white':'#6B7280',
          boxShadow:role===r.id?'0 4px 12px rgba(244,121,32,0.3)':'none',
        }}>
          {r.icon} {r.label}
        </button>
      ))}
    </div>
  );

  const Err = () => error ? (
    <div style={{ background:'#FEE2E2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:16,color:'#DC2626',fontSize:'0.85rem' }}>
      ⚠️ {error}
    </div>
  ) : null;

  const Btn = ({label}) => (
    <button type="submit" disabled={loading} style={{
      width:'100%',padding:'13px',border:'none',borderRadius:12,
      background:loading?'#9CA3AF':'linear-gradient(135deg,#F47920,#D4621A)',
      color:'white',fontSize:'1rem',fontWeight:700,fontFamily:'Nunito,sans-serif',
      cursor:loading?'not-allowed':'pointer',
      boxShadow:loading?'none':'0 6px 20px rgba(244,121,32,0.3)',
    }}>
      {loading ? 'Please wait...' : label}
    </button>
  );

  // ════════════════════════════════════════════════════════
  if (view === 'login') return (
    <div style={{ minHeight:'100vh',display:'flex' }}>
      <Left/>
      <Right>
        <div style={{ marginBottom:26 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'#FFF4ED',border:'1px solid #FFD4B0',borderRadius:999,padding:'4px 12px',marginBottom:16 }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'#F47920',display:'inline-block' }}/>
            <span style={{ fontSize:'0.75rem',color:'#D4621A',fontWeight:700 }}>Secure Admin Portal</span>
          </div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'1.9rem',fontWeight:900,margin:'0 0 5px' }}>Welcome back 👋</h2>
          <p style={{ color:'#6B7280',fontSize:'0.875rem',margin:0 }}>Sign in to manage the HelloCoolie platform</p>
        </div>

        <RoleToggle/>
        <Err/>

        <form onSubmit={handleLogin} autoComplete="on">
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Email Address</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>📧</span>
              <input
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={role==='admin'?'admin@hellocoolie.in':'viewer@hellocoolie.in'}
                style={inp}
              />
            </div>
          </div>

          <div style={{ marginBottom:6 }}>
            <label style={lbl}>Password</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>🔒</span>
              <input
                ref={passRef}
                type={showPass?'text':'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                style={inpPass}
              />
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',padding:4,color:'#9CA3AF' }}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>

          <div style={{ textAlign:'right',marginBottom:20 }}>
            <button type="button" onClick={()=>{setView('forgot_step1');setError('');}} style={{ background:'none',border:'none',color:'#F47920',fontSize:'0.82rem',cursor:'pointer',fontWeight:700,padding:0 }}>
              Forgot password?
            </button>
          </div>

          <Btn label={`Sign in as ${role==='admin'?'👑 Admin':'👁️ Viewer'} →`}/>
        </form>

        <div style={{ marginTop:18,padding:'12px 14px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,fontSize:'0.78rem',color:'#3B82F6',lineHeight:1.7 }}>
          🔒 This portal is for <strong style={{color:'#F47920'}}>Admin</strong> and <strong style={{color:'#1B75BB'}}>Viewer</strong> accounts only.<br/>
          Porters & Passengers use the <strong>HelloCoolie mobile app</strong>.
        </div>
        <p style={{ textAlign:'center',marginTop:16,fontSize:'0.72rem',color:'#9CA3AF' }}>HelloCoolie · "Your Porter, Just a Hello Away!"</p>
      </Right>
      <style>{`.login-input:focus,.login-i:focus{border-color:#F47920!important;box-shadow:0 0 0 3px rgba(244,121,32,0.12);background:white}`}</style>
    </div>
  );

  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step1') return (
    <div style={{ minHeight:'100vh',display:'flex' }}>
      <Left/>
      <Right>
        <button type="button" onClick={()=>{setView('login');setError('');}} style={{ background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:'0.85rem',marginBottom:22,display:'flex',alignItems:'center',gap:6,padding:0,fontWeight:600 }}>← Back</button>
        <div style={{ marginBottom:26 }}>
          <div style={{ fontSize:'2.2rem',marginBottom:10 }}>🔑</div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'1.7rem',fontWeight:900,margin:'0 0 5px' }}>Reset Password</h2>
          <p style={{ color:'#6B7280',fontSize:'0.875rem',margin:0 }}>Verify your identity to continue</p>
        </div>
        <RoleToggle/>
        <div style={{ background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'11px 14px',marginBottom:18,fontSize:'0.8rem',color:'#1D4ED8' }}>
          ℹ️ Admin & Viewer: Email + PAN number required
        </div>
        <Err/>
        <form onSubmit={handleForgotVerify} autoComplete="off">
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Registered Email</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>📧</span>
              <input ref={forgotIdRef} type="email" placeholder="your@email.com" style={inp}/>
            </div>
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={lbl}>PAN Number</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>🪪</span>
              <input ref={verifyRef} type="text" placeholder="ABCDE1234F" style={inp}/>
            </div>
          </div>
          <Btn label="Verify Identity →"/>
        </form>
      </Right>
    </div>
  );

  // ════════════════════════════════════════════════════════
  if (view === 'forgot_step3') return (
    <div style={{ minHeight:'100vh',display:'flex' }}>
      <Left/>
      <Right>
        <button type="button" onClick={()=>{setView('forgot_step1');setError('');}} style={{ background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:'0.85rem',marginBottom:22,display:'flex',alignItems:'center',gap:6,padding:0,fontWeight:600 }}>← Back</button>
        <div style={{ marginBottom:26 }}>
          <div style={{ fontSize:'2.2rem',marginBottom:10 }}>🔐</div>
          <h2 style={{ color:'#111827',fontFamily:'Nunito,sans-serif',fontSize:'1.7rem',fontWeight:900,margin:'0 0 5px' }}>Set New Password</h2>
        </div>
        <Err/>
        <form onSubmit={handleReset} autoComplete="new-password">
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>New Password</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>🔒</span>
              <input ref={newPassRef} type={showPass?'text':'password'} placeholder="Min 6 characters" style={inpPass}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',padding:4 }}>
                {showPass?'🙈':'👁️'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={lbl}>Confirm Password</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}>🔒</span>
              <input ref={confPassRef} type={showPass?'text':'password'} placeholder="Re-enter password" style={inp}/>
            </div>
          </div>
          <Btn label="Reset Password →"/>
        </form>
      </Right>
    </div>
  );

  return null;
}
