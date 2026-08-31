import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { formatNotification } from './formatters.js';
import { emitToUser } from '../config/socket.js';
import { getFirebaseMessaging, sendFcmToUser } from './fcm.js';

// Warm FCM on boot so misconfiguration is visible in logs.
getFirebaseMessaging();

export async function emitNotificationCount(userId) {
  const count = await Notification.countDocuments({
    user: userId,
    read: false,
    archived: false,
  });
  emitToUser(userId.toString(), 'notification:count', { count });
  return count;
}

export async function createNotification({
  userId,
  title,
  body,
  type = 'info',
  customerId = null,
  linkPath = '',
}) {
  const notification = await Notification.create({
    user: userId,
    title,
    body,
    type,
    customer: customerId,
    linkPath: linkPath || '',
  });

  const payload = formatNotification(notification);
  emitToUser(userId.toString(), 'notification:new', payload);
  await emitNotificationCount(userId);

  // Closed-app / background push via FCM (best-effort; never block the API).
  User.findById(userId)
    .select('+fcmTokens')
    .then((user) => {
      if (!user) return null;
      return sendFcmToUser(user, {
        title,
        body,
        data: {
          notificationId: String(notification._id),
          type: String(type || 'info'),
          linkPath: linkPath || '',
          customerId: customerId ? String(customerId) : '',
        },
      });
    })
    .catch((error) => {
      console.warn('[FCM] background send skipped:', error.message);
    });

  return notification;
}
