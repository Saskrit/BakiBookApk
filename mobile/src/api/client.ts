import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyItem, deleteSecureItem, getSecureItem, setSecureItem } from '../utils/secureStorage';
import { API_BASE_URL, PRODUCTION_API, normalizeApiBaseUrl } from '../config/api';
import { notifyMaintenanceMode } from '../contexts/MaintenanceContext';
import { isDeviceOnline } from '../utils/deviceNetwork';
import i18n from '../i18n';

const TOKEN_KEY = 'bakibook_token';
const PREFERRED_API_KEY = 'bakibook_preferred_api';

/** Default request timeout (mobile networks + bcrypt login need headroom). */
const REQUEST_TIMEOUT_MS = 30000;
/** Auth routes can be slower on first TLS handshake from a cold APK. */
const AUTH_TIMEOUT_MS = 45000;

let authToken: string | null = null;
let preferredCleared = false;

export class ApiError extends Error {
  status?: number;
  code?: string;
  data?: Record<string, unknown>;

  constructor(
    message: string,
    options?: { status?: number; code?: string; data?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.data = options?.data;
  }
}

export async function loadToken() {
  authToken = await migrateLegacyItem(TOKEN_KEY, TOKEN_KEY);
  return authToken;
}

export async function setToken(token: string | null) {
  authToken = token;
  if (token) {
    await setSecureItem(TOKEN_KEY, token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await deleteSecureItem(TOKEN_KEY);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (authToken) return authToken;
  authToken = await migrateLegacyItem(TOKEN_KEY, TOKEN_KEY);
  return authToken;
}

/** Drop sticky host from older builds that pointed at HTML fallbacks. */
async function clearStalePreferredHost() {
  if (preferredCleared) return;
  preferredCleared = true;
  try {
    await AsyncStorage.removeItem(PREFERRED_API_KEY);
  } catch {
    // ignore
  }
}

/** Always use the baked production API (same host the website uses). */
export async function getActiveApiBaseUrl(): Promise<string> {
  await clearStalePreferredHost();
  return normalizeApiBaseUrl(API_BASE_URL || PRODUCTION_API) || PRODUCTION_API;
}

function isAuthEndpoint(path: string) {
  return path.startsWith('/auth/');
}

function isTimeoutError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  const message = (err as { message?: string }).message || '';
  return name === 'AbortError' || message === 'TIMEOUT' || /aborted|timed out/i.test(message);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      const timeoutErr = new Error('TIMEOUT');
      timeoutErr.name = 'AbortError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('NON_API_HOST');
  }
  const data = await response.json().catch(() => null);
  if (data == null || typeof data !== 'object') {
    throw new Error('NON_API_HOST');
  }
  return data as Record<string, unknown>;
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = await getActiveApiBaseUrl();
  if (!base) {
    throw new ApiError(i18n.t('errors.notConfigured'));
  }

  if (!authToken) {
    authToken = await migrateLegacyItem(TOKEN_KEY, TOKEN_KEY);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const timeoutMs = isAuthEndpoint(path) ? AUTH_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

  if (!(await isDeviceOnline())) {
    throw new ApiError(i18n.t('errors.noInternet'), { code: 'NO_INTERNET' });
  }

  try {
    const response = await fetchWithTimeout(
      `${base}${path}`,
      {
        ...options,
        headers,
      },
      timeoutMs
    );

    const data = await readJsonResponse(response);

    if (!response.ok) {
      const message = typeof data.message === 'string' ? data.message : undefined;
      const code = typeof data.code === 'string' ? data.code : undefined;
      if (response.status === 503 && code === 'MAINTENANCE') {
        notifyMaintenanceMode(message || i18n.t('maintenance.defaultMessage'));
        throw new ApiError(message || i18n.t('maintenance.defaultMessage'), {
          status: response.status,
          code,
          data,
        });
      }
      if (response.status === 404) {
        throw new ApiError(message || i18n.t('errors.featureUnavailable'), {
          status: response.status,
          code,
          data,
        });
      }
      throw new ApiError(message || i18n.t('errors.generic'), {
        status: response.status,
        code,
        data,
      });
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (!(await isDeviceOnline())) {
      throw new ApiError(i18n.t('errors.noInternet'), { code: 'NO_INTERNET' });
    }
    if (isTimeoutError(err)) {
      throw new ApiError(i18n.t('errors.timeout'));
    }
    throw new ApiError(i18n.t('errors.network'));
  }
}

/** Lightweight health ping used to warm DNS/TLS before login (non-blocking). */
export async function warmApiConnection(): Promise<boolean> {
  if (!(await isDeviceOnline())) return false;
  try {
    const base = await getActiveApiBaseUrl();
    const response = await fetchWithTimeout(
      `${base}/health`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      8000
    );
    const data = await readJsonResponse(response);
    return response.ok && data.status === 'ok';
  } catch {
    return false;
  }
}
