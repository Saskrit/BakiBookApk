import type { User } from '../types';

export function needsEmailVerification(user?: User | null): boolean {
  if (!user) return false;
  if (user.authProvider === 'google') return false;
  return !user.isEmailVerified;
}
