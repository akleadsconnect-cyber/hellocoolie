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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); setError('');
    const r = await login(email, password, role);
    setLoading(false);
    if (!r.ok) setError(r.error);
    else toast(`Welcome back! Logged in as ${role}`, 'success');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF4ED 0%, #EBF4FC 50%, #F9FAFB 100%)',
      padding: 20,
    }}>
      {/* Background decorative circles */}
      <div style={{ position: 'fixed', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(244,121,32,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -80, left: -80, width: 250, height: 250, borderRadius: '50%', background: 'rgba(27,117,187,0.06)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="HelloCoolie" style={{ height: 64, objectFit: 'contain', marginBottom: 8 }} />
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            Admin & Viewer Management Portal
          </p>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {/* Orange top bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, var(--orange), var(--blue))', borderRadius: '12px 12px 0 0' }} />

          <div className="card-body" style={{ padding: '28px 32px 32px' }}>
            <h3 style={{ marginBottom: 4 }}>Sign in</h3>
            <p style={{ marginBottom: 24, color: 'var(--gray-400)', fontSize: '0.85rem' }}>
              Portal access for Admin and Viewer accounts only
            </p>

            {/* Role toggle */}
            <div className="tabs mb-24" style={{ marginBottom: 24 }}>
              <button className={`tab-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
                👑 Admin
              </button>
              <button className={`tab-btn ${role === 'viewer' ? 'active' : ''}`} onClick={() => setRole('viewer')}>
                👁️ Viewer
              </button>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email address</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">📧</span>
                  <input
                    type="email"
                    placeholder={role === 'admin' ? 'admin@hellocoolie.in' : 'viewer@hellocoolie.in'}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Password</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, var(--orange), var(--orange-dk))' }}
              >
                {loading ? <><span className="spinner" /> Signing in...</> : `Sign in as ${role === 'admin' ? 'Admin' : 'Viewer'} →`}
              </button>
            </form>

            <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--gray-500)' }}>
              🔒 This portal is for <strong>Admin</strong> and <strong>Viewer</strong> accounts only.<br />
              Porters and Users must use the <strong>HelloCoolie mobile app</strong>.
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: 'var(--gray-400)' }}>
          HelloCoolie · "Your Porter, Just a Hello Away!"
        </p>
      </div>
    </div>
  );
}
