import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../components/shared';

export default function LoginPage() {
  const { login } = useAuth();
  const [role,     setRole]     = useState('admin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); setError('');
    const r = await login(email, password, role);
    setLoading(false);
    if (!r.ok) setError(r.error);
    else toast(`Welcome back!`, 'success');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0B1120',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: '0 0 52%',
        background: 'linear-gradient(145deg, #F47920 0%, #D4621A 40%, #1B75BB 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background circles */}
        <div style={{ position:'absolute', top:-80, left:-80, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ position:'absolute', bottom:-60, right:-60, width:250, height:250, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ position:'absolute', top:'40%', right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />

        {/* Train track lines */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:6, background:'rgba(255,255,255,0.15)' }} />
        <div style={{ position:'absolute', bottom:18, left:0, right:0, height:3, background:'rgba(255,255,255,0.08)' }} />

        {/* Logo */}
        <div style={{ position:'relative', zIndex:1, textAlign:'center', marginBottom:32 }}>
          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: '16px 28px',
            display: 'inline-block',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            marginBottom: 24,
          }}>
            <img src="/logo.png" alt="HelloCoolie" style={{ height: 64, objectFit:'contain' }} />
          </div>

          <h1 style={{
            fontFamily: 'Nunito, sans-serif',
            fontSize: '2.4rem',
            fontWeight: 900,
            color: 'white',
            margin: '0 0 8px',
            textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>
            India's First
          </h1>
          <h1 style={{
            fontFamily: 'Nunito, sans-serif',
            fontSize: '2.4rem',
            fontWeight: 900,
            color: 'rgba(255,255,255,0.9)',
            margin: '0 0 16px',
          }}>
            Porter Marketplace
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '1.05rem',
            fontStyle: 'italic',
            margin: 0,
          }}>
            "Your Porter, Just a Hello Away!"
          </p>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:16, position:'relative', zIndex:1, flexWrap:'wrap', justifyContent:'center' }}>
          {[
            { val:'23 Cr+', label:'Daily Passengers' },
            { val:'1.5L+', label:'Licensed Porters' },
            { val:'332+', label:'Major Stations' },
          ].map((s,i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              borderRadius: 14,
              padding: '14px 20px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              minWidth: 100,
            }}>
              <div style={{ fontSize:'1.4rem', fontWeight:900, color:'white', fontFamily:'Nunito,sans-serif' }}>{s.val}</div>
              <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.8)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bottom tag */}
        <div style={{
          position: 'absolute', bottom: 28, left: 0, right: 0,
          textAlign: 'center', zIndex: 1,
          color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem'
        }}>
          🚉 Pan-India Railway Porter Booking Platform
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: '#0B1120',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(244,121,32,0.12)', border: '1px solid rgba(244,121,32,0.25)',
              borderRadius: 999, padding: '5px 14px', marginBottom: 20,
            }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#F47920', display:'inline-block', boxShadow:'0 0 8px #F47920' }} />
              <span style={{ fontSize:'0.78rem', color:'#F47920', fontWeight:600 }}>Admin Portal</span>
            </div>
            <h2 style={{ color:'white', fontFamily:'Nunito,sans-serif', fontSize:'1.9rem', fontWeight:900, margin:'0 0 6px' }}>
              Welcome back 👋
            </h2>
            <p style={{ color:'#64748B', fontSize:'0.9rem', margin:0 }}>
              Sign in to manage HelloCoolie platform
            </p>
          </div>

          {/* Role toggle */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 28,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12, padding: 4,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {[
              { id:'admin',  icon:'👑', label:'Admin' },
              { id:'viewer', icon:'👁️', label:'Viewer' },
            ].map(r => (
              <button key={r.id} onClick={() => setRole(r.id)} style={{
                flex: 1, padding: '10px 16px',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
                background: role === r.id
                  ? 'linear-gradient(135deg, #F47920, #D4621A)'
                  : 'transparent',
                color: role === r.id ? 'white' : '#64748B',
                boxShadow: role === r.id ? '0 4px 15px rgba(244,121,32,0.3)' : 'none',
              }}>
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
              borderRadius: 10, padding: '11px 14px', marginBottom: 20,
              color: '#FCA5A5', fontSize: '0.875rem', display:'flex', gap:8, alignItems:'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display:'block', color:'#94A3B8', fontSize:'0.78rem', fontWeight:600, marginBottom:7, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Email Address
              </label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:'1rem' }}>📧</span>
                <input
                  type="email"
                  placeholder={role==='admin' ? 'admin@hellocoolie.in' : 'viewer@hellocoolie.in'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '13px 14px 13px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, color: 'white',
                    fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                    outline: 'none', transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#F47920'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display:'block', color:'#94A3B8', fontSize:'0.78rem', fontWeight:600, marginBottom:7, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Password
              </label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:'1rem' }}>🔒</span>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '13px 42px 13px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, color: 'white',
                    fontSize: '0.9rem', fontFamily: 'Inter, sans-serif',
                    outline: 'none', transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#F47920'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', fontSize:'1rem', padding:4,
                }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#64748B' : 'linear-gradient(135deg, #F47920 0%, #D4621A 100%)',
              border: 'none', borderRadius: 12,
              color: 'white', fontSize: '1rem', fontWeight: 700,
              fontFamily: 'Nunito, sans-serif', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 25px rgba(244,121,32,0.35)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {loading ? (
                <><span style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Signing in...</>
              ) : (
                `Sign in as ${role === 'admin' ? '👑 Admin' : '👁️ Viewer'} →`
              )}
            </button>
          </form>

          {/* Note */}
          <div style={{
            marginTop: 24,
            padding: '12px 16px',
            background: 'rgba(27,117,187,0.08)',
            border: '1px solid rgba(27,117,187,0.2)',
            borderRadius: 10,
            fontSize: '0.78rem',
            color: '#64748B',
            lineHeight: 1.6,
          }}>
            🔒 This portal is for <span style={{ color:'#F47920', fontWeight:700 }}>Admin</span> and <span style={{ color:'#1B75BB', fontWeight:700 }}>Viewer</span> accounts only.<br />
            Porters & Passengers must use the <span style={{ color:'white', fontWeight:600 }}>HelloCoolie mobile app</span>.
          </div>

          <p style={{ textAlign:'center', marginTop:24, fontSize:'0.72rem', color:'#334155' }}>
            HelloCoolie · "Your Porter, Just a Hello Away!"
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #475569; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 30px #0F1929 inset !important;
          -webkit-text-fill-color: white !important;
        }
      `}</style>
    </div>
  );
}
