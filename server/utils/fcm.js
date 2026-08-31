import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let initAttempted = false;
let messaging = null;

function loadServiceAccount() {
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonInline) {
    return JSON.parse(jsonInline);
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const candidates = [
    configuredPath,
    path.resolve(process.cwd(), 'firebase-service-account.json'),
    path.resolve(__dirname, '../firebase-service-account.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  }

  return null;
}

export function getFirebaseMessaging() {
  if (initAttempted) return messaging;
  initAttempted = true;

  try {
    if (admin.apps.length) {
      messaging = admin.messaging();
      return messaging;
    }

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      console.warn(
        '[FCM] No Firebase service account found. Closed-app push disabled. Set FIREBASE_SERVICE_ACCOUNT_PATH or place firebase-service-account.json in server/.'
      );
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    messaging = admin.messaging();
    console.log('[FCM] Firebase Admin initialized');
    return messaging;
  } catch (error) {
    console.error('[FCM] Failed to initialize Firebase Admin:', error.message);
    messaging = null;
    return null;
  }
}

/**
 * Send a data+notification FCM message to one or more device tokens.
 * Removes invalid tokens from the user document.
 */
export async function sendFcmToUser(user, { title, body, data = {} }) {
  const tokens = (user?.fcmTokens || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.token))
    .filter(Boolean);

  if (!tokens.length) return { sent: 0, removed: 0 };

  const fcm = getFirebaseMessaging();
  if (!fcm) return { sent: 0, removed: 0 };

  const stringData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value == null ? '' : String(value)])
  );

  let sent = 0;
  const invalid = [];

  // sendEachForMulticast is available on Admin SDK; fall back to loop if needed
  try {
    const response = await fcm.sendEachForMulticast({
      tokens,
      notification: {
        title: title || 'BakiBook',
        body: body || '',
      },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'bakibook-alerts',
          sound: 'default',
          priority: 'high',
        },
      },
    });

    response.responses.forEach((result, index) => {
      if (result.success) {
        sent += 1;
        return;
      }
      const code = result.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        invalid.push(tokens[index]);
      } else {
        console.warn('[FCM] send failed:', code, result.error?.message);
      }
    });
  } catch (error) {
    console.error('[FCM] sendEachForMulticast failed:', error.message);
    return { sent: 0, removed: 0 };
  }

  if (invalid.length && user?._id) {
    user.fcmTokens = (user.fcmTokens || []).filter((entry) => {
      const token = typeof entry === 'string' ? entry : entry?.token;
      return token && !invalid.includes(token);
    });
    await user.save();
  }

  return { sent, removed: invalid.length };
}
