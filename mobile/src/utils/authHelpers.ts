import type { User } from '../types';

export function needsEmailVerification(user?: User | null): boolean {
  if (!user) return false;
  if (user.authProvider === 'google') return false;
  return !user.isEmailVerified;
}

/** Shop is fully approved by admin — required for customer email / account linking. */
export function isShopVerified(user?: User | null): boolean {
  if (!user || user.role !== 'shopkeeper') return false;
  if (user.shopVerificationStatus) {
    return user.shopVerificationStatus === 'verified';
  }
  return Boolean(user.isShopVerified);
}

export function isShopPendingVerification(user?: User | null): boolean {
  return user?.role === 'shopkeeper' && user.shopVerificationStatus === 'pending';
}

export function isShopRejected(user?: User | null): boolean {
  return user?.role === 'shopkeeper' && user.shopVerificationStatus === 'rejected';
}

/** Owner still needs to submit (or resubmit) shop name, location, and photo. */
export function needsShopSetup(user?: User | null): boolean {
  if (!user || user.role !== 'shopkeeper') return false;
  if (user.canEditShop === false) return false;
  if ((user.teamRole || 'owner') !== 'owner') return false;
  if (isShopVerified(user) || isShopPendingVerification(user)) return false;
  if (user.shopVerificationStatus === 'incomplete' || user.shopVerificationStatus === 'rejected') {
    return true;
  }
  return Boolean(user.needsShopSetup) || !user.isShopVerified;
}

export function isShopProfileComplete(user?: User | null): boolean {
  return Boolean(user?.shopName?.trim() && user?.shopLocation?.trim() && user?.shopImage);
}
