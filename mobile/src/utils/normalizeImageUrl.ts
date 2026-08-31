import { API_BASE_URL, PRODUCTION_API } from '../config/api';
import type { User } from '../types';

function apiOrigin(): string {
  const base = (API_BASE_URL || PRODUCTION_API).replace(/\/api\/?$/i, '');
  return base.replace(/\/+$/, '');
}

/**
 * Turn backend image paths into URLs React Native can load.
 * - Keep Cloudinary URLs (force https)
 * - Rewrite relative `/uploads/...` and localhost hosts to the live API
 */
export function normalizeImageUrlSync(url?: string | null): string {
  let trimmed = url?.trim() || '';
  if (!trimmed) return '';

  // Strip accidental wrapping quotes from DB / JSON
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('content:') ||
    trimmed.startsWith('ph:') ||
    trimmed.startsWith('asset:')
  ) {
    return trimmed;
  }

  // Cloudinary (and any http CDN) must be https — release APK blocks cleartext.
  if (/^http:\/\/res\.cloudinary\.com\//i.test(trimmed)) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  if (/^http:\/\//i.test(trimmed) && /cloudinary\.com/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  // Already a normal remote URL — leave alone (Cloudinary https, etc.)
  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const origin = apiOrigin();
  if (trimmed.startsWith('/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  return trimmed.replace(
    /https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i,
    origin
  );
}

export async function normalizeImageUrl(url?: string | null): Promise<string> {
  return normalizeImageUrlSync(url);
}

export function withNormalizedUserImages<T extends Partial<User>>(user: T): T {
  return {
    ...user,
    profileImage: normalizeImageUrlSync(user.profileImage),
    shopImage: normalizeImageUrlSync(user.shopImage),
  };
}

export function isDisplayableImageUri(uri?: string | null): boolean {
  const value = normalizeImageUrlSync(uri);
  if (!value) return false;
  return (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('file:') ||
    value.startsWith('content:') ||
    value.startsWith('data:image/') ||
    value.startsWith('ph:')
  );
}
