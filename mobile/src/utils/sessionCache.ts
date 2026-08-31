import { getStoredAuth } from '../api/auth';
import { loadToken } from '../api/client';
import { fetchCustomers } from '../api/customers';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
} from '../api/notifications';
import { fetchPortalDashboard, fetchPortalLedger } from '../api/portal';
import { fetchProducts } from '../api/products';
import { fetchDashboardStats, type DashboardResponse } from '../api/shop';
import type { Customer } from '../types';
import type { AppNotification } from '../types/notification';
import { warmAuthServices } from './warmApi';

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  data: T;
  at: number;
};

type SessionCache = {
  dashboard?: CacheEntry<DashboardResponse>;
  customers?: CacheEntry<Customer[]>;
  products?: CacheEntry<unknown>;
  notifications?: CacheEntry<AppNotification[]>;
  unreadCount?: CacheEntry<number>;
  portalDashboard?: CacheEntry<unknown>;
  portalLedger?: CacheEntry<unknown>;
};

const cache: SessionCache = {};
let preloadPromise: Promise<void> | null = null;
let preloadedForUserId: string | null = null;

function isFresh<T>(entry?: CacheEntry<T>): entry is CacheEntry<T> {
  return Boolean(entry && Date.now() - entry.at < CACHE_TTL_MS);
}

export function getCachedDashboard(): DashboardResponse | null {
  return isFresh(cache.dashboard) ? cache.dashboard.data : null;
}

export function getCachedCustomers(): Customer[] | null {
  return isFresh(cache.customers) ? cache.customers.data : null;
}

export function getCachedNotifications(): AppNotification[] | null {
  return isFresh(cache.notifications) ? cache.notifications.data : null;
}

export function getCachedUnreadCount(): number | null {
  return isFresh(cache.unreadCount) ? cache.unreadCount.data : null;
}

export function getCachedPortalDashboard<T = unknown>(): T | null {
  return isFresh(cache.portalDashboard) ? (cache.portalDashboard.data as T) : null;
}

export function getCachedPortalLedger<T = unknown>(): T | null {
  return isFresh(cache.portalLedger) ? (cache.portalLedger.data as T) : null;
}

export function invalidateSessionCache(scopes?: Array<keyof SessionCache>) {
  if (!scopes?.length) {
    (Object.keys(cache) as Array<keyof SessionCache>).forEach((key) => {
      delete cache[key];
    });
    preloadedForUserId = null;
    return;
  }
  for (const key of scopes) {
    delete cache[key];
  }
}

async function preloadShopkeeper() {
  await Promise.allSettled([
    fetchDashboardStats().then((data) => {
      cache.dashboard = { data, at: Date.now() };
    }),
    fetchCustomers({ page: 1, limit: 50 }).then((data) => {
      cache.customers = { data: data.customers || [], at: Date.now() };
    }),
    fetchProducts().then((data) => {
      cache.products = { data, at: Date.now() };
    }),
    fetchNotifications(1, 50).then((data) => {
      cache.notifications = { data: data.notifications || [], at: Date.now() };
    }),
    fetchUnreadNotificationCount().then((data) => {
      cache.unreadCount = { data: data.count || 0, at: Date.now() };
    }),
  ]);
}

async function preloadCustomer() {
  await Promise.allSettled([
    fetchPortalDashboard().then((data) => {
      cache.portalDashboard = { data, at: Date.now() };
    }),
    fetchPortalLedger().then((data) => {
      cache.portalLedger = { data, at: Date.now() };
    }),
    fetchNotifications(1, 50).then((data) => {
      cache.notifications = { data: data.notifications || [], at: Date.now() };
    }),
    fetchUnreadNotificationCount().then((data) => {
      cache.unreadCount = { data: data.count || 0, at: Date.now() };
    }),
  ]);
}

/**
 * Warm API + preload the signed-in user's main screens during splash.
 * Safe to call multiple times — concurrent callers share one promise.
 */
export function preloadSessionCache(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    warmAuthServices();
    try {
      await loadToken();
      const stored = await getStoredAuth();
      if (!stored?.user) return;

      const userId = String(stored.user.id);
      if (preloadedForUserId === userId && isFresh(cache.dashboard || cache.portalDashboard)) {
        return;
      }

      if (stored.user.role === 'shopkeeper') {
        await preloadShopkeeper();
      } else if (stored.user.role === 'customer') {
        await preloadCustomer();
      }
      preloadedForUserId = userId;
    } catch {
      // Splash should never block on cache failures
    }
  })().finally(() => {
    // Allow a later splash/login to refresh
    setTimeout(() => {
      preloadPromise = null;
    }, 2_000);
  });

  return preloadPromise;
}
