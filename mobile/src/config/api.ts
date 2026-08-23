import Constants from 'expo-constants';

const PRODUCTION_API = 'https://bakibookapp.onrender.com/api';
const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];

function isLoopbackApi(url: string): boolean {
  return /10\.0\.2\.2|127\.0\.0\.1|localhost/i.test(url);
}

function resolveApiBaseUrl(): string {
  const envUrl = fromEnv?.trim() || '';
  const extraUrl = fromExtra?.trim() || '';

  if (__DEV__) {
    // Physical phone cannot reach the emulator loopback address.
    if (envUrl && !(Constants.isDevice && isLoopbackApi(envUrl))) return envUrl;
    if (extraUrl && !(Constants.isDevice && isLoopbackApi(extraUrl))) return extraUrl;
    if (debuggerHost && !Constants.isDevice) return `http://${debuggerHost}:5001/api`;
    return PRODUCTION_API;
  }

  if (extraUrl && !isLoopbackApi(extraUrl)) return extraUrl;
  if (envUrl && !isLoopbackApi(envUrl)) return envUrl;
  return PRODUCTION_API;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Socket.IO server origin (strip trailing /api). */
export function getSocketOrigin(): string {
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return base || 'http://10.0.2.2:5001';
}
