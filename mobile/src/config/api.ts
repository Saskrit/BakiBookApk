import Constants from 'expo-constants';

/** Production API on VPS — same host the website uses. */
export const PRODUCTION_API = 'https://api.bakibook.run.place/api';

const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const fromEnv = process.env.EXPO_PUBLIC_API_URL;

function isLoopbackApi(url: string): boolean {
  return /10\.0\.2\.2|127\.0\.0\.1|localhost/i.test(url);
}

function isDeadHost(url: string): boolean {
  return /onrender\.com|railway\.app/i.test(url);
}

/** Ensure base is `…/api` with no trailing slash after /api. */
export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

/**
 * Resolve API base URL.
 * - Explicit EXPO_PUBLIC_API_URL / app.config extra wins (for local backend).
 * - Loopback URLs are ignored on physical devices (unreachable).
 * - Dead hosts (Render/Railway) are ignored.
 * - Otherwise always use the production VPS API.
 */
function resolveApiBaseUrl(): string {
  const envUrl = fromEnv?.trim() || '';
  const extraUrl = fromExtra?.trim() || '';

  const candidates = [envUrl, extraUrl].filter(Boolean);
  for (const url of candidates) {
    if (Constants.isDevice && isLoopbackApi(url)) continue;
    if (isDeadHost(url)) continue;
    const normalized = normalizeApiBaseUrl(url);
    if (normalized) return normalized;
  }

  return PRODUCTION_API;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Socket.IO server origin (strip trailing /api). */
export function getSocketOrigin(apiBase: string = API_BASE_URL): string {
  const base = apiBase.replace(/\/api\/?$/i, '');
  return base || PRODUCTION_API.replace(/\/api\/?$/i, '');
}
