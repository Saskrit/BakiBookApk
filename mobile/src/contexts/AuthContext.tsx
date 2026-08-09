import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuth,
  fetchMe,
  getStoredAuth,
  googleAuth as apiGoogleAuth,
  login as apiLogin,
  register as apiRegister,
  saveAuth,
} from '../api/auth';
import { loadToken } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    role: 'shopkeeper' | 'customer';
    fullName: string;
    email: string;
    password: string;
  }) => Promise<User>;
  googleSignIn: (payload: {
    credential: string;
    mode: 'login' | 'register';
    role?: 'shopkeeper' | 'customer';
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  applyUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await loadToken();
        const stored = await getStoredAuth();
        if (stored) {
          setUser(stored.user);
          try {
            const me = await fetchMe();
            setUser(me.user);
          } catch {
            await clearAuth();
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin({ email, password });
    const nextUser = { ...data.user, pendingLinkCount: data.pendingLinkCount };
    await saveAuth(data.token, nextUser, data.pendingLinkCount);
    setUser(nextUser);
    return nextUser;
  }, []);

  const register = useCallback(
    async (payload: {
      role: 'shopkeeper' | 'customer';
      fullName: string;
      email: string;
      password: string;
    }) => {
      const data = await apiRegister(payload);
      const nextUser = { ...data.user, pendingLinkCount: data.pendingLinkCount };
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const googleSignIn = useCallback(
    async (payload: {
      credential: string;
      mode: 'login' | 'register';
      role?: 'shopkeeper' | 'customer';
    }) => {
      const data = await apiGoogleAuth(payload);
      const nextUser = { ...data.user, pendingLinkCount: data.pendingLinkCount };
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me.user);
    await saveAuth((await getStoredAuth())?.token || '', me.user);
  }, []);

  const applyUser = useCallback(async (next: User) => {
    setUser(next);
    const token = (await getStoredAuth())?.token || '';
    if (token) await saveAuth(token, next);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, googleSignIn, logout, refreshUser, applyUser }),
    [user, loading, login, register, googleSignIn, logout, refreshUser, applyUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
