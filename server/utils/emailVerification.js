import User from '../models/User.js';
import { hashToken } from './emailToken.js';

/** One-time legacy verify links expire after 10 minutes. */
export const LEGACY_VERIFY_LINK_TTL_MS = 10 * 60 * 1000;

export async function verifyEmailByToken(rawToken) {
  const token = String(rawToken || '').trim();

  if (!token) {
    return { ok: false, message: 'Verification link is missing or invalid.' };
  }

  const hashed = hashToken(token);

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    return {
      ok: false,
      message:
        'This verification link is invalid or has expired. Open the BakiBook app, sign in, and request a new link.',
    };
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return {
    ok: true,
    message: 'Your email is verified. You can use the app.',
    user,
  };
}

export function renderVerifyEmailHtml({ success, message }) {
  const title = success ? 'Email verified' : 'Verification failed';
  const icon = success ? '✓' : '✕';
  const iconClass = success ? 'icon success' : 'icon error';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — BakiBook</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        background: #FBF6F6;
        color: #454040;
      }
      .card {
        width: min(440px, 100%);
        text-align: center;
        padding: 40px 32px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(76, 92, 45, 0.12);
        border: 1px solid #e8e0e0;
      }
      .icon {
        width: 56px;
        height: 56px;
        margin: 0 auto 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 700;
      }
      .icon.success { background: #e8f3dc; color: #4C5C2D; }
      .icon.error { background: #fdecec; color: #b42318; }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 12px;
        color: #4C5C2D;
      }
      p {
        color: #666;
        font-size: 0.975rem;
        line-height: 1.55;
      }
      .brand {
        margin-top: 24px;
        font-size: 0.8125rem;
        color: #999;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="${iconClass}">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <p class="brand">BakiBook</p>
    </div>
  </body>
</html>`;
}
