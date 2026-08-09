import { request } from './client';
import type { AppNotification } from '../types/notification';

export const fetchNotifications = (page = 1, limit = 40) =>
  request<{
    success: boolean;
    notifications: AppNotification[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/ledger/notifications?page=${page}&limit=${limit}`);

export const fetchUnreadNotificationCount = () =>
  request<{ success: boolean; count: number }>('/ledger/notifications/unread-count');

export const markNotificationRead = (id: string) =>
  request<{ success: boolean; notification: AppNotification }>(
    `/ledger/notifications/${id}/read`,
    { method: 'PATCH' }
  );

export const markAllNotificationsRead = () =>
  request<{ success: boolean }>('/ledger/notifications/read-all', { method: 'PATCH' });

export const archiveNotification = (id: string) =>
  request<{ success: boolean; notification: AppNotification }>(
    `/ledger/notifications/${id}/archive`,
    { method: 'PATCH' }
  );

export const deleteNotification = (id: string) =>
  request<{ success: boolean }>(`/ledger/notifications/${id}`, { method: 'DELETE' });
