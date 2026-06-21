'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  verifyToken,
} from '@/lib/admin-client';
import AdminShell from '@/components/admin/AdminShell';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setChecking(false);
      return;
    }
    verifyToken(stored).then((ok) => {
      if (ok) setToken(stored);
      else clearStoredToken();
      setChecking(false);
    });
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await verifyToken(input.trim());
    setLoading(false);
    if (ok) {
      setStoredToken(input.trim());
      setToken(input.trim());
    } else {
      setError('Token inválido. Verifique ADMIN_TOKEN no servidor.');
    }
  }, [input]);

  const handleLogout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setInput('');
  }, []);

  if (checking) {
    return (
      <div className="admin-root">
        <div className="admin-loading">Verificando acesso…</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="admin-root">
        <div className="admin-login">
          <div className="admin-login-card">
            <div className="admin-login-logo">🛒</div>
            <h1>Redirect Shopee</h1>
            <p>Painel de gestão de links de afiliado</p>
            {error && <div className="admin-alert admin-alert-error">{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="admin-field">
                <label htmlFor="token">Token de admin</label>
                <input
                  id="token"
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Cole o ADMIN_TOKEN"
                  autoComplete="current-password"
                  required
                />
                <p className="admin-field-hint">
                  O mesmo valor configurado em ADMIN_TOKEN no servidor.
                </p>
              </div>
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <AdminShell onLogout={handleLogout}>{children}</AdminShell>;
}
