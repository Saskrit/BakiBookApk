import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import i18n from '../i18n';
import type { ShopBackupPayload } from '../api/backup';
import {
  configureGoogleSignIn,
  isGoogleSignInAvailable,
  loadGoogleModule,
  signOutGoogleSdk,
} from './googleSignIn';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'BakiBook Backups';
const BACKUP_MIME = 'application/json';

const LAST_BACKUP_AT_KEY = 'bakibook_last_backup_at';
const LAST_BACKUP_NAME_KEY = 'bakibook_last_backup_name';
const DRIVE_EMAIL_KEY = 'bakibook_drive_email';
const DRIVE_CONNECTED_KEY = 'bakibook_drive_connected';

export type DriveBackupFile = {
  id: string;
  name: string;
  modifiedTime: string;
  size?: number;
  shopOwnerId?: string;
};

type DriveFileList = {
  files?: Array<{
    id: string;
    name: string;
    modifiedTime: string;
    size?: string;
    appProperties?: Record<string, string>;
  }>;
};

async function driveFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Drive API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function emailsMatch(a?: string | null, b?: string | null) {
  return Boolean(a?.trim() && b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase());
}

async function rejectMismatchedGoogleAccount(expectedEmail: string, actualEmail: string): Promise<never> {
  await signOutGoogleSdk();
  await AsyncStorage.multiRemove([DRIVE_EMAIL_KEY, DRIVE_CONNECTED_KEY]);
  throw new Error(
    i18n.t('backupRestore.googleEmailMismatch', {
      account: expectedEmail.trim(),
      drive: actualEmail.trim(),
    })
  );
}

export async function ensureDriveAccessToken(
  accountEmail: string,
  options?: { forceAccountPicker?: boolean }
): Promise<string> {
  const expectedEmail = accountEmail.trim();
  if (!expectedEmail) {
    throw new Error(i18n.t('backupRestore.driveAuthFailed'));
  }

  if (!isGoogleSignInAvailable()) {
    throw new Error(i18n.t('backupRestore.googleNotConfigured'));
  }

  configureGoogleSignIn();
  const mod = loadGoogleModule();
  if (!mod) {
    throw new Error(i18n.t('backupRestore.googleNotConfigured'));
  }

  if (Platform.OS === 'android') {
    await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  let current = options?.forceAccountPicker ? null : await mod.GoogleSignin.getCurrentUser();
  const currentEmail = current?.user?.email?.trim() || '';

  // Never silently reuse another Gmail. Always show the account picker on connect,
  // and whenever the cached Google session is missing or belongs to a different account.
  if (options?.forceAccountPicker || !current || !emailsMatch(expectedEmail, currentEmail)) {
    await signOutGoogleSdk();
    const signIn = await mod.GoogleSignin.signIn();
    if (signIn.type === 'cancelled') {
      throw new Error(i18n.t('auth.googleCancelled'));
    }
    current = signIn.data;
  }

  const email = current?.user?.email?.trim() || '';
  if (!email) {
    await signOutGoogleSdk();
    throw new Error(i18n.t('backupRestore.driveAuthFailed'));
  }
  if (!emailsMatch(expectedEmail, email)) {
    await rejectMismatchedGoogleAccount(expectedEmail, email);
  }

  try {
    await mod.GoogleSignin.addScopes({ scopes: [DRIVE_FILE_SCOPE] });
  } catch {
    // User may already have granted scopes.
  }

  const tokens = await mod.GoogleSignin.getTokens();
  if (!tokens.accessToken) {
    throw new Error(i18n.t('backupRestore.driveAuthFailed'));
  }

  await AsyncStorage.setItem(DRIVE_EMAIL_KEY, email);
  return tokens.accessToken;
}

async function findBackupFolder(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`
  );
  const data = await driveFetch<DriveFileList>(
    accessToken,
    `/files?spaces=drive&fields=files(id,name)&q=${query}`
  );
  return data.files?.[0]?.id ?? null;
}

async function getOrCreateBackupFolder(accessToken: string): Promise<string> {
  const existing = await findBackupFolder(accessToken);
  if (existing) return existing;

  const created = await driveFetch<{ id: string }>(accessToken, '/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!created.id) {
    throw new Error(i18n.t('backupRestore.folderCreateFailed'));
  }
  return created.id;
}

function buildBackupFileName(shopName: string, exportedAt: string) {
  const safeShop = shopName.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'shop';
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  return `BakiBook-${safeShop}-${stamp}.json`;
}

export async function uploadBackupToDrive(
  backupJson: string,
  meta: { shopName: string; shopOwnerId: string; exportedAt: string; accountEmail: string }
): Promise<{ fileId: string; fileName: string }> {
  const accessToken = await ensureDriveAccessToken(meta.accountEmail);
  const folderId = await getOrCreateBackupFolder(accessToken);
  const fileName = buildBackupFileName(meta.shopName, meta.exportedAt);

  const metadata = {
    name: fileName,
    mimeType: BACKUP_MIME,
    parents: [folderId],
    appProperties: {
      bakibookBackup: '1',
      shopOwnerId: meta.shopOwnerId,
      schemaVersion: '1',
    },
  };

  const boundary = `bakibook_${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${BACKUP_MIME}\r\n\r\n` +
    `${backupJson}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    let message = i18n.t('backupRestore.uploadFailed');
    try {
      const err = (await response.json()) as { error?: { message?: string } };
      if (err.error?.message) message = err.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const file = (await response.json()) as { id: string; name: string };
  const email = await AsyncStorage.getItem(DRIVE_EMAIL_KEY);
  await AsyncStorage.multiSet([
    [LAST_BACKUP_AT_KEY, meta.exportedAt],
    [LAST_BACKUP_NAME_KEY, file.name || fileName],
    [DRIVE_CONNECTED_KEY, '1'],
    ...(email ? [[DRIVE_EMAIL_KEY, email] as [string, string]] : []),
  ]);

  return { fileId: file.id, fileName: file.name || fileName };
}

export async function listDriveBackups(accountEmail: string): Promise<DriveBackupFile[]> {
  const accessToken = await ensureDriveAccessToken(accountEmail);
  const folderId = await findBackupFolder(accessToken);
  if (!folderId) return [];

  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and mimeType='${BACKUP_MIME}'`
  );
  const data = await driveFetch<DriveFileList>(
    accessToken,
    `/files?spaces=drive&fields=files(id,name,modifiedTime,size,appProperties)&orderBy=modifiedTime desc&q=${query}`
  );

  return (data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    size: file.size ? Number(file.size) : undefined,
    shopOwnerId: file.appProperties?.shopOwnerId,
  }));
}

export async function downloadDriveBackup(fileId: string, accountEmail: string): Promise<string> {
  const accessToken = await ensureDriveAccessToken(accountEmail);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(i18n.t('backupRestore.downloadFailed'));
  }

  return response.text();
}

export async function getStoredDriveEmail(): Promise<string | null> {
  return AsyncStorage.getItem(DRIVE_EMAIL_KEY);
}

export async function isDriveConnected(accountEmail?: string): Promise<boolean> {
  const flag = await AsyncStorage.getItem(DRIVE_CONNECTED_KEY);
  const email = await getStoredDriveEmail();
  if (flag !== '1' || !email) return false;
  if (accountEmail?.trim() && !emailsMatch(accountEmail, email)) {
    await AsyncStorage.multiRemove([DRIVE_EMAIL_KEY, DRIVE_CONNECTED_KEY]);
    return false;
  }
  return true;
}

export async function connectGoogleDrive(accountEmail: string): Promise<string> {
  await ensureDriveAccessToken(accountEmail, { forceAccountPicker: true });
  const email = await getStoredDriveEmail();
  if (!email || !emailsMatch(accountEmail, email)) {
    await AsyncStorage.multiRemove([DRIVE_EMAIL_KEY, DRIVE_CONNECTED_KEY]);
    throw new Error(i18n.t('backupRestore.driveAuthFailed'));
  }
  await AsyncStorage.setItem(DRIVE_CONNECTED_KEY, '1');
  return email;
}

export async function disconnectGoogleDrive(): Promise<void> {
  await AsyncStorage.multiRemove([DRIVE_EMAIL_KEY, DRIVE_CONNECTED_KEY]);
  await signOutGoogleSdk();
}

export async function getLastBackupMeta(): Promise<{ at: string | null; name: string | null }> {
  const pairs = await AsyncStorage.multiGet([LAST_BACKUP_AT_KEY, LAST_BACKUP_NAME_KEY]);
  return {
    at: pairs[0]?.[1] ?? null,
    name: pairs[1]?.[1] ?? null,
  };
}

export function parseBackupJson(raw: string): ShopBackupPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(i18n.t('backupRestore.invalidFile'));
  }
  return parsed as ShopBackupPayload;
}
