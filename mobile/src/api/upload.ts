import * as FileSystem from 'expo-file-system/legacy';
import { ApiError, getActiveApiBaseUrl, getAuthToken } from './client';
import { isDeviceOnline } from '../utils/deviceNetwork';
import i18n from '../i18n';

export type UploadType = 'profile' | 'shop' | 'payment';

const UPLOAD_TIMEOUT_MS = 60000;

function mimeFromUri(uri: string) {
  const path = uri.split('?')[0] || uri;
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function normalizeFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) {
    return uri;
  }
  if (uri.startsWith('file:')) {
    return uri.replace(/^file:\/*/i, 'file:///');
  }
  return `file://${uri}`;
}

function parseUploadBody(body: string | null | undefined) {
  if (!body) return {} as { message?: string; url?: string; success?: boolean };
  try {
    return JSON.parse(body) as { message?: string; url?: string; success?: boolean };
  } catch {
    return {} as { message?: string; url?: string; success?: boolean };
  }
}

/** Same as web: use the Cloudinary URL the API returns. */
function publicImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^http:\/\/.*cloudinary\.com/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  return trimmed;
}

export async function uploadImage(localUri: string, type: UploadType): Promise<string> {
  if (!(await isDeviceOnline())) {
    throw new ApiError(i18n.t('errors.noInternet'), { code: 'NO_INTERNET' });
  }

  const apiBase = await getActiveApiBaseUrl();
  if (!apiBase) {
    throw new Error(i18n.t('errors.notConfigured'));
  }

  const token = await getAuthToken();
  if (!token) {
    throw new Error('Please sign in again to upload photos');
  }

  const sourceUri = normalizeFileUri(localUri);
  const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
  if (!sourceInfo.exists) {
    throw new Error(i18n.t('upload.pickFailed'));
  }

  const mimeType = mimeFromUri(sourceUri);
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const uploadUri = `${FileSystem.cacheDirectory}bakibook-send-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: uploadUri });

  const url = `${apiBase}/upload/${type}`;

  try {
    const result = await Promise.race([
      FileSystem.uploadAsync(url, uploadUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'image',
        mimeType,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(i18n.t('errors.timeout'))), UPLOAD_TIMEOUT_MS);
      }),
    ]);

    const data = parseUploadBody(result.body);
    if (result.status >= 200 && result.status < 300 && data.url) {
      return publicImageUrl(data.url);
    }
    throw new Error(data.message || i18n.t('upload.uploadFailed'));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (!(await isDeviceOnline())) {
      throw new ApiError(i18n.t('errors.noInternet'), { code: 'NO_INTERNET' });
    }
    if (err instanceof Error && err.message === i18n.t('errors.timeout')) {
      throw err;
    }
    if (err instanceof Error && err.message) throw err;
    throw new ApiError(i18n.t('errors.network'));
  }
}
