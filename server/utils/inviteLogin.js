import crypto from 'crypto';
import { hashToken } from './emailToken.js';
import { queueEmail, sendShopTeamInviteEmail } from './emailService.js';

/** Invited first-login codes stay valid for 48 hours. */
export const INVITE_LOGIN_CODE_TTL_MS = 48 * 60 * 60 * 1000;
export const INVITE_LOGIN_MAX_ATTEMPTS = 8;

export function isInviteActivationPending(user) {
  return Boolean(
    user &&
      user.role === 'shopkeeper' &&
      user.mustChangePassword &&
      (user.shopOwner || user.teamRole === 'partner' || user.teamRole === 'staff')
  );
}

export function generateInviteLoginCode() {
  return String(crypto.randomInt(100000, 999999));
}

/** Random unusable password until the invitee sets their own via email code. */
export function generateLockedInvitePassword() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store a fresh invite login code on the user and email it.
 * @returns {{ code: string, emailQueued: boolean }}
 */
export async function issueInviteLoginCode(user, meta = {}) {
  const code = generateInviteLoginCode();
  user.inviteLoginCodeHash = hashToken(code);
  user.inviteLoginCodeExpires = new Date(Date.now() + INVITE_LOGIN_CODE_TTL_MS);
  user.inviteLoginAttempts = 0;
  await user.save();

  queueEmail(
    () =>
      sendShopTeamInviteEmail({
        inviteeEmail: user.email,
        ownerName: meta.ownerName || 'A shop owner',
        shopName: meta.shopName || 'BakiBook shop',
        teamRole: meta.teamRole || user.teamRole || 'staff',
        code,
      }),
    `shop-team-invite:${user.email}`
  );

  return { code, emailQueued: true };
}
