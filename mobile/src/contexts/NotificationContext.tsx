import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  archiveNotification as apiArchive,
  deleteNotification as apiDelete,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkRead,
} from '../api/notifications';
import type { AppNotification } from '../types/notification';
import { useAuth } from './AuthContext';
import { useSocket, useSocketEvent } from './SocketContext';
import {
  getNotificationPermissionStatus,
  presentDeviceNotification,
  registerDevicePushTokenWithServer,
  requestNotificationPermissions,
  setDeviceBadgeCount,
} from '../utils/deviceNotifications';

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  notificationsEnabled: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  enableDeviceNotifications: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function sortNewest(list: AppNotification[]) {
  return [...list].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { connected } = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const userId = user?.id ? String(user.id) : null;
  const prevConnected = useRef(false);
  const hadConnected = useRef(false);
  const refreshInFlight = useRef(false);

  const refreshPermissionState = useCallback(async () => {
    const status = await getNotificationPermissionStatus();
    setNotificationsEnabled(status === 'granted');
    return status === 'granted';
  }, []);

  const enableDeviceNotifications = useCallback(async () => {
    const granted = await requestNotificationPermissions({ force: true });
    setNotificationsEnabled(granted);
    if (granted) await registerDevicePushTokenWithServer();
    return granted;
  }, []);

  const refresh = useCallback(async (opts?: { showLoading?: boolean }) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const showLoading = Boolean(opts?.showLoading);
    if (showLoading) setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        fetchNotifications(1, 50),
        fetchUnreadNotificationCount(),
      ]);
      setNotifications(sortNewest(listRes.notifications || []));
      setUnreadCount(countRes.count || 0);
    } catch {
      // Keep existing state on transient network errors
    } finally {
      refreshInFlight.current = false;
      if (showLoading) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsEnabled(false);
      prevConnected.current = false;
      hadConnected.current = false;
      void setDeviceBadgeCount(0);
      return;
    }
    void refresh({ showLoading: true });
    void refreshPermissionState().then((granted) => {
      if (granted) {
        void registerDevicePushTokenWithServer();
      } else {
        void requestNotificationPermissions();
      }
    });
  }, [userId, authLoading, refresh, refreshPermissionState]);

  useEffect(() => {
    void setDeviceBadgeCount(unreadCount);
  }, [unreadCount]);

  // Only refetch after a real reconnect (offline → online), not on every connected=true render.
  useEffect(() => {
    if (!userId) return;
    if (connected && !prevConnected.current && hadConnected.current) {
      void refresh({ showLoading: false });
    }
    if (connected) hadConnected.current = true;
    prevConnected.current = connected;
  }, [connected, userId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) void refresh({ showLoading: false });
    });
    return () => sub.remove();
  }, [refresh, userId]);

  const onNew = useCallback((payload: AppNotification) => {
    if (!payload?.id) return;
    setNotifications((prev) => {
      if (prev.some((n) => n.id === payload.id)) {
        return sortNewest(prev.map((n) => (n.id === payload.id ? { ...n, ...payload } : n)));
      }
      return sortNewest([{ ...payload, read: Boolean(payload.read) }, ...prev]);
    });
    if (!payload.read) {
      void presentDeviceNotification(payload);
    }
  }, []);

  const onCount = useCallback((payload: { count?: number }) => {
    if (typeof payload?.count === 'number') {
      setUnreadCount(payload.count);
    }
  }, []);

  useSocketEvent<AppNotification>('notification:new', onNew, Boolean(userId));
  useSocketEvent<{ count?: number }>('notification:count', onCount, Boolean(userId));

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiMarkRead(id);
    } catch {
      void refresh({ showLoading: false });
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiMarkAllRead();
    } catch {
      void refresh({ showLoading: false });
    }
  }, [refresh]);

  const archive = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiArchive(id);
    } catch {
      void refresh({ showLoading: false });
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
    try {
      await apiDelete(id);
    } catch {
      void refresh({ showLoading: false });
    }
  }, [refresh]);

  const publicRefresh = useCallback(() => refresh({ showLoading: true }), [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      connected,
      notificationsEnabled,
      refresh: publicRefresh,
      markRead,
      markAllRead,
      archive,
      remove,
      enableDeviceNotifications,
    }),
    [
      notifications,
      unreadCount,
      loading,
      connected,
      notificationsEnabled,
      publicRefresh,
      markRead,
      markAllRead,
      archive,
      remove,
      enableDeviceNotifications,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
