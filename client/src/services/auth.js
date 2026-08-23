import request from './api';
import { fetchPendingLinks } from './links';

const AUTH_KEY = 'bakibook_auth';
const TOKEN_KEY = 'bakibook_token';
/** Keep users signed in for 30 days (matches JWT expiry). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const saveAuth = (token, user, pendingLinkCount, options = {}) => {
  const sessionExpiresAt =
    options.sessionExpiresAt ?? Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      ...user,
      ...(pendingLinkCount != null ? { pendingLinkCount } : {}),
      sessionExpiresAt,
    })
  );
};

export const getAuth = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(AUTH_KEY);

  if (!token || !userJson) return null;

  try {
    const user = JSON.parse(userJson);
    if (
      typeof user.sessionExpiresAt === 'number' &&
      Date.now() > user.sessionExpiresAt
    ) {
      clearAuth();
      return null;
    }
    return { token, user };
  } catch {
    return null;
  }
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_KEY);
};

export const register = (payload) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const login = (payload) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const googleAuth = (payload) =>
  request('/auth/google', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateProfile = (payload) =>
  request('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const needsShopSetup = (user) =>
  user?.role === 'shopkeeper' &&
  (user?.shopVerificationStatus
    ? user.shopVerificationStatus !== 'verified'
    : Boolean(user?.needsShopSetup) || !user?.isShopVerified);

export const isShopPendingVerification = (user) =>
  user?.role === 'shopkeeper' && user?.shopVerificationStatus === 'pending';

export function getPostAuthPath(user, pendingLinkCount) {
  if (user?.isAdmin) return '/admin';
  if (user?.role === 'shopkeeper') return '/dashboard';
  if (user?.role === 'customer') {
    const count = pendingLinkCount ?? user?.pendingLinkCount ?? 0;
    if (count > 0) return '/portal/link-shops';
    return '/portal';
  }
  return '/dashboard';
}

export function getRoleHomePath(user, pendingLinkCount) {
  return getPostAuthPath(user, pendingLinkCount);
}

export function canAccessAdmin(user) {
  return Boolean(user?.isAdmin);
}

export function canAccessShopkeeper(user) {
  return user?.role === 'shopkeeper' && !user?.isAdmin;
}

export function canAccessCustomer(user) {
  return user?.role === 'customer' && !user?.isAdmin;
}

export async function resolvePostAuthPath(user, pendingLinkCount) {
  if (pendingLinkCount != null) {
    return getPostAuthPath(user, pendingLinkCount);
  }

  if (user?.role === 'customer') {
    try {
      const data = await fetchPendingLinks();
      return getPostAuthPath(user, data.count);
    } catch {
      return '/portal';
    }
  }

  return getPostAuthPath(user);
}

export const getGoogleAuthRedirectPath = () => '/auth/redirect';

export const fetchMe = () => request('/auth/me');

export const verifyEmailToken = (token) => request(`/auth/verify-email/${token}`);

export const verifyEmail = verifyEmailToken;

export const resendVerification = () =>
  request('/auth/resend-verification', { method: 'POST' });

/** Legacy unverified accounts (pre code-signup). Requires email + password. */
export const resendVerificationLink = (email, password) =>
  request('/auth/resend-verification-link', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const forgotPassword = (email) =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token, password) =>
  request(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

export const logout = () => {
  clearAuth();
};
