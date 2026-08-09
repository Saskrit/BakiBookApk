import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  connected: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
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

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [user?.id, authLoading, refresh]);

  // Refresh when socket reconnects or app becomes active
  useEffect(() => {
    if (connected && user) void refresh();
  }, [connected, user?.id, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) void refresh();
    });
    return () => sub.remove();
  }, [refresh, user]);

  const onNew = useCallback((payload: AppNotification) => {
    if (!payload?.id) return;
    setNotifications((prev) => {
      if (prev.some((n) => n.id === payload.id)) {
        return sortNewest(prev.map((n) => (n.id === payload.id ? { ...n, ...payload } : n)));
      }
      return sortNewest([{ ...payload, read: Boolean(payload.read) }, ...prev]);
    });
    // Unread badge is set accurately by notification:count from the server
  }, []);

  const onCount = useCallback((payload: { count?: number }) => {
    if (typeof payload?.count === 'number') {
      setUnreadCount(payload.count);
    }
  }, []);

  useSocketEvent<AppNotification>('notification:new', onNew, Boolean(user));
  useSocketEvent<{ count?: number }>('notification:count', onCount, Boolean(user));

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiMarkRead(id);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiMarkAllRead();
    } catch {
      void refresh();
    }
  }, [refresh]);

  const archive = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiArchive(id);
    } catch {
      void refresh();
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
      void refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      connected,
      refresh,
      markRead,
      markAllRead,
      archive,
      remove,
    }),
    [
      notifications,
      unreadCount,
      loading,
      connected,
      refresh,
      markRead,
      markAllRead,
      archive,
      remove,
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
