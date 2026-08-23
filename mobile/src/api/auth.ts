import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, setToken } from './client';
import type { AuthResponse, User } from '../types';

const AUTH_KEY = 'bakibook_auth';
const TOKEN_KEY = 'bakibook_token';
/** Keep users signed in for 30 days (matches JWT expiry). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

type StoredAuthPayload = User & {
  pendingLinkCount?: number;
  sessionExpiresAt?: number;
};

function stripSessionMeta(payload: StoredAuthPayload): User {
  const { pendingLinkCount: _p, sessionExpiresAt: _e, ...user } = payload;
  return user as User;
}

export async function saveAuth(
  token: string,
  user: User,
  pendingLinkCount?: number,
  options?: { sessionExpiresAt?: number }
) {
  await setToken(token);
  const sessionExpiresAt =
    options?.sessionExpiresAt ?? Date.now() + SESSION_DURATION_MS;
  await AsyncStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      ...user,
      ...(pendingLinkCount != null ? { pendingLinkCount } : {}),
      sessionExpiresAt,
    })
  );
}

export async function getStoredAuth(): Promise<{
  token: string;
  user: User;
  sessionExpiresAt?: number;
} | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const userJson = await AsyncStorage.getItem(AUTH_KEY);
  if (!token || !userJson) return null;
  try {
    const parsed = JSON.parse(userJson) as StoredAuthPayload;
    const sessionExpiresAt = parsed.sessionExpiresAt;
    if (typeof sessionExpiresAt === 'number' && Date.now() > sessionExpiresAt) {
      await clearAuth();
      return null;
    }
    return {
      token,
      user: stripSessionMeta(parsed),
      sessionExpiresAt,
    };
  } catch {
    return null;
  }
}

export async function clearAuth() {
  await setToken(null);
  await AsyncStorage.removeItem(AUTH_KEY);
}

export const login = (payload: { email: string; password: string }) => {
  const email = payload.email.trim();
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: email,
      email,
      password: payload.password,
    }),
  });
};

export const register = (payload: {
  role: 'shopkeeper' | 'customer';
  fullName: string;
  email: string;
  password: string;
}) =>
  request<{
    success: boolean;
    message: string;
    requiresVerification?: boolean;
    email?: string;
    role?: 'shopkeeper' | 'customer';
    token?: string;
    user?: User;
    pendingLinkCount?: number;
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const verifyRegistration = (payload: {
  email: string;
  role: 'shopkeeper' | 'customer';
  code: string;
}) =>
  request<AuthResponse>('/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const resendRegistrationCode = (payload: {
  email: string;
  role: 'shopkeeper' | 'customer';
}) =>
  request<{ success: boolean; message: string; email: string; role: string }>(
    '/auth/register/resend-code',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

export const googleAuth = (payload: {
  credential: string;
  mode: 'login' | 'register';
  role?: 'shopkeeper' | 'customer';
  fullName?: string;
  profileImage?: string;
}) =>
  request<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchMe = () => request<{ success: boolean; user: User }>('/auth/me');

export const updateProfile = (payload: Record<string, unknown>) =>
  request<{ success: boolean; message: string; user: User }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const updateTutorialProgress = (payload: {
  stepId?: string;
  completed?: boolean;
  completedStepIds?: string[];
  reset?: boolean;
}) =>
  request<{ success: boolean; message: string; user: User }>('/auth/tutorial', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const changePassword = (payload: { currentPassword: string; newPassword: string }) =>
  request<{ success: boolean; message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const resendVerificationEmail = () =>
  request<{ success: boolean; message: string }>('/auth/resend-verification', {
    method: 'POST',
  });

/** Legacy unverified accounts (created before code signup) — public, needs password. */
export const resendVerificationLink = (payload: { email: string; password: string }) =>
  request<{
    success: boolean;
    message: string;
    verificationMethod?: 'link';
    email?: string;
  }>('/auth/resend-verification-link', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  });

export const requestEmailChange = (newEmail: string, password: string) =>
  request<{
    success: boolean;
    message: string;
    pendingEmail: string;
    expiresInSeconds: number;
  }>('/auth/change-email/request', {
    method: 'POST',
    body: JSON.stringify({ newEmail, password }),
  });

export const confirmEmailChange = (code: string) =>
  request<{ success: boolean; message: string; user: User }>(
    '/auth/change-email/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    }
  );

export const forgotPassword = (email: string) =>
  request<{ success: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const fetchPendingLinks = () =>
  request<{ success: boolean; count: number }>('/links/pending');
