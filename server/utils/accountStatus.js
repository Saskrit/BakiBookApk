/** Account moderation statuses controlled by admins. */
export const ACCOUNT_STATUSES = ['active', 'suspended', 'banned'];

export function resolveAccountStatus(user) {
  const status = user?.accountStatus;
  if (status === 'suspended' || status === 'banned') return status;
  return 'active';
}

export function accountStatusDenial(user) {
  const status = resolveAccountStatus(user);
  if (status === 'banned') {
    return {
      status: 403,
      code: 'ACCOUNT_BANNED',
      message:
        user?.accountStatusReason?.trim() ||
        'Your account has been banned. Contact support if you believe this is a mistake.',
    };
  }
  if (status === 'suspended') {
    return {
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
      message:
        user?.accountStatusReason?.trim() ||
        'Your account is suspended. Contact support for more information.',
    };
  }
  return null;
}
