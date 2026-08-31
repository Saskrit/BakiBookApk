import ShopMembership from '../models/ShopMembership.js';
import { emitToUser, getIO } from '../config/socket.js';

/** Tell a connected client to refresh profile state (shop verification, account status, etc.). */
export function emitUserSync(userId, payload = {}) {
  if (!userId) return;
  emitToUser(String(userId), 'user:sync', { at: Date.now(), ...payload });
}

/** Tell a connected client to reload cached lists (dashboard, customers, ledger, …). */
export function emitDataInvalidate(userId, scopes = ['all']) {
  if (!userId) return;
  const list = Array.isArray(scopes) ? scopes : [scopes];
  emitToUser(String(userId), 'data:invalidate', { scopes: list, at: Date.now() });
}

/** Push user/data sync to the shop owner and all active team members. */
export async function emitShopDataSync(shopOwnerId, options = {}) {
  if (!shopOwnerId) return;

  const {
    scopes = ['dashboard', 'customers', 'all'],
    excludeUserId = null,
    userSync = null,
  } = options;

  const ownerId = String(shopOwnerId);
  const memberships = await ShopMembership.find({
    shopOwner: shopOwnerId,
    status: 'active',
  }).select('member');

  const userIds = new Set([ownerId, ...memberships.map((m) => String(m.member))]);
  if (excludeUserId) userIds.delete(String(excludeUserId));

  for (const userId of userIds) {
    if (userSync) emitUserSync(userId, userSync);
    emitDataInvalidate(userId, scopes);
  }
}

/** Broadcast maintenance mode changes to every connected client. */
export function broadcastMaintenance(settings) {
  const io = getIO();
  if (!io) return;

  io.emit('maintenance:updated', {
    maintenanceMode: Boolean(settings.maintenanceMode),
    message: settings.maintenanceMessage || '',
    at: Date.now(),
  });
}
