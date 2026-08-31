import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuth,
  fetchMe,
  getStoredAuth,
  googleAuth as apiGoogleAuth,
  login as apiLogin,
  register as apiRegister,
  resendRegistrationCode as apiResendRegistrationCode,
  saveAuth,
  verifyRegistration as apiVerifyRegistration,
  activateInviteLogin as apiActivateInviteLogin,
  resendInviteLoginCode as apiResendInviteLoginCode,
} from '../api/auth';
import { ApiError, loadToken } from '../api/client';
import type { User } from '../types';
import { invalidateSessionCache } from '../utils/sessionCache';
import { unregisterDevicePushTokenFromServer } from '../utils/deviceNotifications';
import { withNormalizedUserImages } from '../utils/normalizeImageUrl';

function isUnauthorized(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    role: 'shopkeeper' | 'customer';
    fullName: string;
    email: string;
    password: string;
  }) => Promise<
    | {
        requiresVerification: true;
        email: string;
        role: 'shopkeeper' | 'customer';
        emailSent?: boolean;
        message?: string;
      }
    | User
  >;
  verifyRegistration: (payload: {
    email: string;
    role: 'shopkeeper' | 'customer';
    code: string;
  }) => Promise<User>;
  resendRegistrationCode: (payload: {
    email: string;
    role: 'shopkeeper' | 'customer';
  }) => Promise<{ emailSent?: boolean; message?: string }>;
  activateInvite: (payload: {
    email: string;
    code: string;
    password: string;
  }) => Promise<User>;
  resendInviteCode: (email: string) => Promise<{ emailSent?: boolean; message?: string }>;
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
        if (!stored) return;

        // Restore session immediately so the user stays signed in for 30 days.
        setUser(withNormalizedUserImages(stored.user));
        try {
          const me = await fetchMe();
          const normalized = withNormalizedUserImages(me.user);
          setUser(normalized);
          await saveAuth(stored.token, normalized, undefined, {
            sessionExpiresAt: stored.sessionExpiresAt,
          });
        } catch (err) {
          // Only force logout when the token is invalid/expired — not on network blips.
          if (isUnauthorized(err)) {
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
    const nextUser = withNormalizedUserImages({
      ...data.user,
      pendingLinkCount: data.pendingLinkCount,
    });
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
      if (data.requiresVerification || !data.token || !data.user) {
        return {
          requiresVerification: true as const,
          email: data.email || payload.email.trim().toLowerCase(),
          role: (data.role as 'shopkeeper' | 'customer') || payload.role,
          emailSent: data.emailSent,
          message: data.message,
        };
      }
      const nextUser = withNormalizedUserImages({
        ...data.user,
        pendingLinkCount: data.pendingLinkCount,
      });
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const verifyRegistration = useCallback(
    async (payload: {
      email: string;
      role: 'shopkeeper' | 'customer';
      code: string;
    }) => {
      const data = await apiVerifyRegistration(payload);
      const nextUser = withNormalizedUserImages({
        ...data.user,
        pendingLinkCount: data.pendingLinkCount,
      });
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const resendRegistrationCode = useCallback(
    async (payload: { email: string; role: 'shopkeeper' | 'customer' }) => {
      const data = await apiResendRegistrationCode(payload);
      return { emailSent: data.emailSent, message: data.message };
    },
    []
  );

  const activateInvite = useCallback(
    async (payload: { email: string; code: string; password: string }) => {
      const data = await apiActivateInviteLogin(payload);
      const nextUser = withNormalizedUserImages({
        ...data.user,
        pendingLinkCount: data.pendingLinkCount,
      });
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const resendInviteCode = useCallback(async (email: string) => {
    const data = await apiResendInviteLoginCode(email);
    return { emailSent: data.emailSent, message: data.message };
  }, []);

  const googleSignIn = useCallback(
    async (payload: {
      credential: string;
      mode: 'login' | 'register';
      role?: 'shopkeeper' | 'customer';
    }) => {
      const data = await apiGoogleAuth(payload);
      const nextUser = withNormalizedUserImages({
        ...data.user,
        pendingLinkCount: data.pendingLinkCount,
      });
      await saveAuth(data.token, nextUser, data.pendingLinkCount);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  const logout = useCallback(async () => {
    invalidateSessionCache();
    await unregisterDevicePushTokenFromServer();
    await clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = await getStoredAuth();
    const me = await fetchMe();
    const normalized = withNormalizedUserImages(me.user);
    setUser(normalized);
    if (stored?.token) {
      await saveAuth(stored.token, normalized, undefined, {
        sessionExpiresAt: stored.sessionExpiresAt,
      });
    }
  }, []);

  const applyUser = useCallback(async (next: User) => {
    const stored = await getStoredAuth();
    // Prefer the new URL; only fall back to stored when the API omits the field.
    const profileImage =
      next.profileImage !== undefined && next.profileImage !== null
        ? next.profileImage
        : stored?.user.profileImage || '';
    const shopImage =
      next.shopImage !== undefined && next.shopImage !== null
        ? next.shopImage
        : stored?.user.shopImage || '';
    const normalized = withNormalizedUserImages({
      ...next,
      profileImage: profileImage || stored?.user.profileImage || '',
      shopImage: shopImage || stored?.user.shopImage || '',
    });
    setUser(normalized);
    if (stored?.token) {
      await saveAuth(stored.token, normalized, undefined, {
        sessionExpiresAt: stored.sessionExpiresAt,
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      verifyRegistration,
      resendRegistrationCode,
      activateInvite,
      resendInviteCode,
      googleSignIn,
      logout,
      refreshUser,
      applyUser,
    }),
    [
      user,
      loading,
      login,
      register,
      verifyRegistration,
      resendRegistrationCode,
      activateInvite,
      resendInviteCode,
      googleSignIn,
      logout,
      refreshUser,
      applyUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
