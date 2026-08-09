import request from './api';

export const fetchAdminDashboard = () => request('/admin/dashboard');

export const fetchAdminShops = () => request('/admin/shops');

export const verifyAdminShop = (shopId) =>
  request(`/admin/shops/${shopId}/verify`, { method: 'PATCH' });

export const rejectAdminShop = (shopId, reason) =>
  request(`/admin/shops/${shopId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

export const fetchAdminUsers = () => request('/admin/users');

export const fetchAdminAnalytics = () => request('/admin/analytics');

export const fetchPlatformStats = () => request('/stats');

export const fetchMaintenanceSettings = () => request('/admin/maintenance');

export const updateMaintenanceSettings = (payload) =>
  request('/admin/maintenance', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
