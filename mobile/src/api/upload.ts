import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export type UploadType = 'profile' | 'shop' | 'payment';

function mimeFromUri(uri: string) {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export async function uploadImage(localUri: string, type: UploadType): Promise<string> {
  if (!API_BASE_URL) {
    throw new Error('API URL is not configured');
  }

  const token = await AsyncStorage.getItem('bakibook_token');
  const filename = `photo-${Date.now()}.jpg`;
  const mimeType = mimeFromUri(localUri);
  const uri = localUri.startsWith('file://') ? localUri : `file://${localUri}`;

  const formData = new FormData();
  formData.append('image', {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/upload/${type}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    url?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || 'Image upload failed');
  }

  if (!data.url) {
    throw new Error('Upload succeeded but no image URL was returned');
  }

  return data.url;
}
