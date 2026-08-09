import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];

function resolveApiBaseUrl(): string {
  // In development, prefer Metro/.env over values baked into the APK at build time.
  // (Baked Railway URLs caused "Application not found" after the deploy went offline.)
  if (__DEV__) {
    if (fromEnv?.trim()) return fromEnv.trim();
    if (fromExtra?.trim()) return fromExtra.trim();
    if (debuggerHost) return `http://${debuggerHost}:5001/api`;
    // Android emulator → host machine localhost
    if (Platform.OS === 'android') return 'http://10.0.2.2:5001/api';
    return 'http://localhost:5001/api';
  }

  if (fromExtra?.trim()) return fromExtra.trim();
  if (fromEnv?.trim()) return fromEnv.trim();

  console.warn(
    'EXPO_PUBLIC_API_URL is not set. Set it in eas.json or: eas secret:create --name EXPO_PUBLIC_API_URL'
  );
  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Socket.IO server origin (strip trailing /api). */
export function getSocketOrigin(): string {
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return base || 'http://10.0.2.2:5001';
}
