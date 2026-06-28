import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = api.getSession();
    const token   = api.getToken();
    if (session && token) setUser(session);
    setLoading(false);
  }, []);

  const login = async (email, password, role) => {
    const r = role === 'admin'
      ? await api.loginAdmin(email, password)
      : await api.loginViewer(email, password);
    if (!r.ok) return { ok: false, error: r.error };
    const userData = r.data.admin || r.data.viewer;
    userData.role  = role;
    api.setToken(r.data.token);
    api.setSession(userData);
    setUser(userData);
    return { ok: true };
  };

  const logout = () => {
    api.clear();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

// ── Generic data hook ──────────────────────────────────────
export function useData(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = async () => {
    setLoading(true);
    const r = await fetcher();
    if (r.ok) { setData(r.data); setError(null); }
    else setError(r.error);
    setLoading(false);
  };

  useEffect(() => { load(); }, deps); // eslint-disable-line
  return { data, loading, error, reload: load };
}
