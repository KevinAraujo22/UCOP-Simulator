import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, User } from '@ucop/shared';
import { api, ApiError, getStoredToken, storeToken } from './api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getStoredToken());

  const apply = useCallback((res: AuthResponse | null) => {
    storeToken(res?.token ?? null);
    setToken(res?.token ?? null);
    setUser(res?.user ?? null);
  }, []);

  // Valida o token salvo (e renova o cookie das imagens) ao abrir o app.
  useEffect(() => {
    if (!getStoredToken()) return;
    api<AuthResponse>('/api/auth/me')
      .then(apply)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) apply(null);
      })
      .finally(() => setLoading(false));
  }, [apply]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      async login(email, password) {
        apply(await api<AuthResponse>('/api/auth/login', { body: { email, password } }));
      },
      async register(name, email, password) {
        apply(await api<AuthResponse>('/api/auth/register', { body: { name, email, password } }));
      },
      logout() {
        void api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        apply(null);
      },
    }),
    [user, token, loading, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
