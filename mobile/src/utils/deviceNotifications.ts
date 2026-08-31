import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { AppNotification } from '../types/notification';
import { registerPushToken, unregisterPushToken } from '../api/auth';

const ANDROID_CHANNEL_ID = 'bakibook-alerts';

let channelReady = false;
let permissionAsked = false;
let lastRegisteredToken: string | null = null;

/** Show banners + status-bar alerts while the app is open. */
export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'BakiBook alerts',
    description: 'Payments, shop updates, and account alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4C5C2D',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  channelReady = true;
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Fetch native FCM token and POST it to the API so the server can push
 * when the app is closed / killed.
 */
export async function registerDevicePushTokenWithServer(): Promise<string | null> {
  try {
    await ensureAndroidChannel();
    const granted = await getNotificationPermissionStatus();
    if (granted !== 'granted') return null;

    const device = await Notifications.getDevicePushTokenAsync();
    const token = typeof device?.data === 'string' ? device.data : null;
    if (!token) return null;

    if (token === lastRegisteredToken) return token;

    await registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    lastRegisteredToken = token;
    return token;
  } catch (error) {
    console.warn(
      '[push] Failed to register FCM token:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function unregisterDevicePushTokenFromServer(): Promise<void> {
  try {
    const token = lastRegisteredToken;
    lastRegisteredToken = null;
    await unregisterPushToken(token || undefined);
  } catch {
    // Best-effort on logout
  }
}

/** Ask once per app session after sign-in (Android 13+ POST_NOTIFICATIONS). */
export async function requestNotificationPermissions(options?: {
  force?: boolean;
}): Promise<boolean> {
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    await registerDevicePushTokenWithServer();
    return true;
  }
  if (permissionAsked && !options?.force) return false;

  permissionAsked = true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  if (status === 'granted') {
    await registerDevicePushTokenWithServer();
  }
  return status === 'granted';
}

export async function presentDeviceNotification(notification: AppNotification) {
  const granted = await getNotificationPermissionStatus();
  if (granted !== 'granted') return;

  await ensureAndroidChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title || 'BakiBook',
      body: notification.body || '',
      data: {
        notificationId: notification.id,
        linkPath: notification.linkPath,
        customerId: notification.customerId,
      },
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function setDeviceBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // Badge unsupported on some Android launchers
  }
}
