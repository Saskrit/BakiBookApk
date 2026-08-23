import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { notifyMaintenanceMode } from '../contexts/MaintenanceContext';
import i18n from '../i18n';

const TOKEN_KEY = 'bakibook_token';

let authToken: string | null = null;

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
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

export async function setToken(token: string | null) {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (authToken) return authToken;
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(i18n.t('errors.notConfigured'));
  }

  if (!authToken) {
    authToken = await AsyncStorage.getItem(TOKEN_KEY);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(i18n.t('errors.network'));
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (data as { message?: string }).message;
    const code = (data as { code?: string }).code;
    if (response.status === 503 && code === 'MAINTENANCE') {
      notifyMaintenanceMode(message || i18n.t('maintenance.defaultMessage'));
      throw new ApiError(message || i18n.t('maintenance.defaultMessage'), {
        status: response.status,
        code,
        data: data as Record<string, unknown>,
      });
    }
    if (response.status === 404) {
      throw new ApiError(message || i18n.t('errors.featureUnavailable'), {
        status: response.status,
        code,
        data: data as Record<string, unknown>,
      });
    }
    throw new ApiError(message || i18n.t('errors.generic'), {
      status: response.status,
      code,
      data: data as Record<string, unknown>,
    });
  }

  return data as T;
}
