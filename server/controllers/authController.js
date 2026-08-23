import crypto from 'crypto';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
import Customer from '../models/Customer.js';
import generateToken from '../utils/generateToken.js';
import { createEmailToken, hashToken } from '../utils/emailToken.js';
import {
  queueEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendEmailChangeCode,
  sendPasswordResetEmail,
} from '../utils/emailService.js';
import { verifyGoogleToken } from '../utils/googleVerify.js';
import { assertEmailAvailableForRole } from '../utils/emailRoleGuard.js';
import { resolveImageUrl } from '../utils/imageUpload.js';
import { isAdminEmail, getAdminEmails, matchesAdminCredentials, getAdminEnvEmail, getAdminEnvPassword } from '../utils/adminCheck.js';
import { notifyPendingInvitationsForUser } from './linkController.js';
import { createNotification } from '../utils/notify.js';
import {
  formatTutorialProgress,
  sanitizeTutorialStepIds,
  TUTORIAL_STEP_ID_SET,
} from '../utils/tutorialCatalog.js';

const isShopDetailsComplete = (user) =>
  Boolean(user.shopName?.trim() && user.shopLocation?.trim() && user.shopImage);

const resolveShopVerificationStatus = (user) => {
  if (user.role !== 'shopkeeper') return null;
  if (user.shopVerificationStatus) return user.shopVerificationStatus;
  return user.isShopVerified ? 'verified' : 'incomplete';
};

const notifyAdminsShopPending = async (shopkeeper) => {
  const adminEmails = getAdminEmails();
  if (!adminEmails.length) return;

  const admins = await User.find({ email: { $in: adminEmails } });
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        title: 'Shop verification pending',
        body: `${shopkeeper.shopName || shopkeeper.fullName} submitted shop details for admin review.`,
        type: 'info',
      })
    )
  );
};

const applyShopVerificationState = async (user, { notifyAdmin = true } = {}) => {
  if (user.role !== 'shopkeeper') return;

  if (isShopDetailsComplete(user)) {
    user.shopVerificationStatus = 'pending';
    user.isShopVerified = false;
    if (notifyAdmin) await notifyAdminsShopPending(user);
  } else {
    user.shopVerificationStatus = 'incomplete';
    user.isShopVerified = false;
  }
};

const formatUser = (user) => {
  const shopVerificationStatus = resolveShopVerificationStatus(user);

  return {
    id: user._id,
    role: user.role,
    fullName: user.fullName,
    profileImage: user.profileImage || '',
    email: user.email,
    phone: user.phone || '',
    shopName: user.shopName || '',
    shopLocation: user.shopLocation || '',
    shopImage: user.shopImage || '',
    authProvider: user.authProvider || 'local',
    isEmailVerified: user.isEmailVerified,
    isShopVerified: user.isShopVerified,
    shopVerificationStatus,
    needsShopSetup: user.role === 'shopkeeper' && shopVerificationStatus !== 'verified',
    isAdmin: isAdminEmail(user.email),
    preferredLanguage: user.preferredLanguage === 'ne' ? 'ne' : 'en',
    tutorialProgress: formatTutorialProgress(user),
    createdAt: user.createdAt,
  };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCustomerPendingLinkCount = async (user) => {
  if (user.role !== 'customer' || !user.email) return 0;
  return Customer.countDocuments({
    email: user.email.toLowerCase(),
    linkStatus: 'pending',
    linkedUser: null,
  });
};

const sendAuthResponse = async (res, user, message, status = 200) => {
  const token = generateToken(user._id, user.role);
  const pendingLinkCount =
    user.role === 'customer' ? await getCustomerPendingLinkCount(user) : 0;

  return res.status(status).json({
    success: true,
    message,
    token,
    user: formatUser(user),
    pendingLinkCount,
  });
};

const resolveAdminLoginUser = async () => {
  const email = getAdminEnvEmail();
  const password = getAdminEnvPassword();
  if (!email || !password) return null;

  let user = await User.findOne({ email, role: 'shopkeeper' }).select('+password');

  if (!user) {
    return User.create({
      role: 'shopkeeper',
      fullName: 'BakiBook Admin',
      email,
      password,
      isEmailVerified: true,
      isShopVerified: true,
      shopVerificationStatus: 'verified',
      shopName: 'BakiBook Admin',
      shopLocation: 'Nepal',
    });
  }

  user.password = password;
  user.isEmailVerified = true;
  user.isShopVerified = true;
  user.shopVerificationStatus = 'verified';
  await user.save();
  return user;
};

const sendRegistrationEmails = async (user, rawVerificationToken) => {
  try {
    await Promise.all([
      sendWelcomeEmail(user),
      sendVerificationEmail(user, rawVerificationToken),
    ]);
    console.log(`Registration emails sent to ${user.email}`);
  } catch (error) {
    console.error(`Failed to send email to ${user.email}:`, error.message);
  }
};

export const registerUser = async (req, res) => {
  try {
    const { role, fullName, email, password } = req.body;

    if (!role || !['shopkeeper', 'customer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }

    if (!fullName?.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    if (!email?.trim() || !emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailCheck = await assertEmailAvailableForRole(normalizedEmail, role);
    if (!emailCheck.ok) {
      return res.status(emailCheck.status).json({ success: false, message: emailCheck.message });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const passwordHash = await PendingRegistration.hashPassword(password);

    await PendingRegistration.findOneAndUpdate(
      { email: normalizedEmail, role },
      {
        role,
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        codeHash: hashToken(code),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        attempts: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Await send with a short timeout so the client gets an honest emailSent flag.
    // Pending signup is saved either way; user can tap Resend if SMTP fails.
    let emailSent = false;
    let emailErrorMessage = '';
    try {
      await sendVerificationEmail(
        { fullName: fullName.trim(), email: normalizedEmail },
        code
      );
      emailSent = true;
    } catch (emailError) {
      emailErrorMessage = emailError.message || 'Email send failed';
      console.error(
        `Failed to send registration code to ${normalizedEmail}:`,
        emailErrorMessage
      );
    }

    return res.status(200).json({
      success: true,
      requiresVerification: true,
      emailSent,
      message: emailSent
        ? 'We sent a verification code to your email. Enter it to finish creating your account.'
        : 'Your signup is saved, but the verification email could not be sent. Tap Resend code, and make sure EMAIL_USER / EMAIL_APP_PASSWORD are set on the server.',
      email: normalizedEmail,
      role,
      ...(emailSent
        ? {}
        : { emailError: 'smtp_failed', emailErrorDetail: emailErrorMessage }),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

export const verifyRegistration = async (req, res) => {
  try {
    const { email, role, code } = req.body;
    const normalizedEmail = email?.trim()?.toLowerCase();
    const trimmedCode = String(code || '').trim();

    if (!role || !['shopkeeper', 'customer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit verification code' });
    }

    const pending = await PendingRegistration.findOne({ email: normalizedEmail, role }).select(
      '+passwordHash +codeHash'
    );

    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please register again.',
      });
    }

    if (pending.attempts >= 8) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please register again.',
      });
    }

    if (pending.codeHash !== hashToken(trimmedCode)) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    const emailCheck = await assertEmailAvailableForRole(normalizedEmail, role);
    if (!emailCheck.ok) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(emailCheck.status).json({ success: false, message: emailCheck.message });
    }

    const user = await User.create({
      role,
      fullName: pending.fullName,
      email: normalizedEmail,
      password: crypto.randomBytes(16).toString('hex'),
      authProvider: 'local',
      isEmailVerified: true,
      shopVerificationStatus: 'incomplete',
      isShopVerified: false,
    });

    await User.collection.updateOne(
      { _id: user._id },
      { $set: { password: pending.passwordHash } }
    );

    await PendingRegistration.deleteOne({ _id: pending._id });

    sendWelcomeEmail(user).catch((error) => {
      console.error(`Failed to send welcome email to ${user.email}:`, error.message);
    });

    let pendingLinkCount = 0;
    if (role === 'customer') {
      pendingLinkCount = await getCustomerPendingLinkCount(user);
      notifyPendingInvitationsForUser(user).catch((error) => {
        console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
      });
    }

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: 'Email verified. Your account is ready.',
      token,
      user: formatUser(user),
      pendingLinkCount,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Verification failed',
    });
  }
};

export const resendRegistrationCode = async (req, res) => {
  try {
    const { email, role } = req.body;
    const normalizedEmail = email?.trim()?.toLowerCase();

    if (!role || !['shopkeeper', 'customer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    const pending = await PendingRegistration.findOne({ email: normalizedEmail, role }).select(
      '+passwordHash +codeHash'
    );

    if (!pending) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration found. Please sign up again.',
      });
    }

    const code = String(crypto.randomInt(100000, 999999));
    pending.codeHash = hashToken(code);
    pending.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    pending.attempts = 0;
    await pending.save();

    let emailSent = false;
    try {
      await sendVerificationEmail(
        { fullName: pending.fullName, email: normalizedEmail },
        code
      );
      emailSent = true;
    } catch (emailError) {
      console.error(
        `Failed to resend registration code to ${normalizedEmail}:`,
        emailError.message
      );
    }

    return res.json({
      success: true,
      emailSent,
      message: emailSent
        ? 'A new verification code was sent to your email.'
        : 'Could not send the email right now. Check server email settings (EMAIL_USER / EMAIL_APP_PASSWORD on Render), then try Resend again.',
      email: normalizedEmail,
      role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend verification code',
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginEmail = (identifier || email)?.trim();

    if (!loginEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const trimmed = loginEmail.toLowerCase();

    if (!emailRegex.test(trimmed)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    if (matchesAdminCredentials(trimmed, password)) {
      const adminUser = await resolveAdminLoginUser();
      if (!adminUser) {
        return res.status(500).json({
          success: false,
          message: 'Admin login is not configured on the server',
        });
      }

      const token = generateToken(adminUser._id, adminUser.role);
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: formatUser(adminUser),
      });
    }

    const users = await User.find({ email: trimmed }).select('+password');

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const matchedUsers = [];
    for (const candidate of users) {
      if (!candidate.password && candidate.googleId) continue;
      if (candidate.password && (await candidate.matchPassword(password))) {
        matchedUsers.push(candidate);
      }
    }

    if (!matchedUsers.length) {
      const googleOnly = users.find((candidate) => candidate.googleId && !candidate.password);
      if (googleOnly) {
        return res.status(401).json({
          success: false,
          message: 'This account uses Google sign-in. Please login with Google.',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user =
      matchedUsers.find((candidate) => isAdminEmail(candidate.email)) ||
      matchedUsers.find((candidate) => candidate.role === 'shopkeeper') ||
      matchedUsers[0];

    if (user.authProvider !== 'google' && !user.isEmailVerified) {
      // Legacy accounts (created before code-based signup): queue a one-time verify link.
      // Do not await SMTP — that made login hang for 30s+ when Gmail stalled.
      // New signups never create a User until the register code is verified.
      let linkSent = true;
      try {
        await issueLegacyVerificationLink(user);
      } catch (emailError) {
        linkSent = false;
        console.error(
          `Failed to prepare legacy verification link for ${user.email}:`,
          emailError.message
        );
      }

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        verificationMethod: 'link',
        linkSent,
        email: user.email,
        role: user.role,
        message: linkSent
          ? 'Your account still needs email verification. We sent a one-time verification link to your email. Open it, then sign in again.'
          : 'Your account still needs email verification. We could not send the link just now — tap Resend verification link and try again.',
      });
    }

    if (user.role === 'customer') {
      notifyPendingInvitationsForUser(user).catch((error) => {
        console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
      });
    }

    return sendAuthResponse(res, user, 'Login successful');
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const hashed = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link',
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Email verification failed',
    });
  }
};

/** Save a one-time verify link token and queue the email (non-blocking). */
async function issueLegacyVerificationLink(user) {
  const rawVerificationToken = createEmailToken();
  user.emailVerificationToken = hashToken(rawVerificationToken);
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();
  queueEmail(
    () =>
      sendVerificationEmail(
        { fullName: user.fullName, email: user.email },
        rawVerificationToken
      ),
    `verification-link:${user.email}`
  );
  return rawVerificationToken;
}

/**
 * Authenticated resend — link for legacy unverified accounts only.
 * New signups use /register/resend-code (6-digit codes) instead.
 */
export const resendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+emailVerificationToken +emailVerificationExpires'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    await issueLegacyVerificationLink(user);

    return res.json({
      success: true,
      verificationMethod: 'link',
      message: 'Verification link sent! Please check your inbox.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend verification email',
    });
  }
};

/**
 * Public resend for legacy unverified users who cannot sign in yet.
 * Requires email + password so only the account owner can request the link.
 * New registrations should use /register/resend-code (codes), not this endpoint.
 */
export const resendVerificationLink = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim()?.toLowerCase();

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      '+password +emailVerificationToken +emailVerificationExpires'
    );

    // Same generic response when missing / wrong password to avoid account enumeration.
    const deny = () =>
      res.status(400).json({
        success: false,
        message: 'If this account needs verification, check your email or confirm your password and try again.',
      });

    if (!user || user.authProvider === 'google' || !user.password) {
      return deny();
    }
    if (!(await user.matchPassword(password))) {
      return deny();
    }
    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'This email is already verified. You can sign in.',
      });
    }

    await issueLegacyVerificationLink(user);

    return res.json({
      success: true,
      verificationMethod: 'link',
      email: user.email,
      message: 'We sent a one-time verification link to your email. Open it, then sign in.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send verification link',
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordResetToken +passwordResetExpires'
    );

    if (user && user.password) {
      const rawResetToken = createEmailToken();
      user.passwordResetToken = hashToken(rawResetToken);
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      await user.save();

      queueEmail(
        () => sendPasswordResetEmail(user, rawResetToken),
        `password-reset:${user.email}`
      );
    }

    return res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process password reset request',
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const hashed = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset password',
    });
  }
};

export const getMe = async (req, res) => {
  return res.json({
    success: true,
    user: formatUser(req.user),
  });
};

const linkGoogleToUser = async (user, googleUser, profileImage) => {
  if (!user.profileImage && (profileImage || googleUser.picture)) {
    user.profileImage = profileImage || googleUser.picture;
  }
  if (googleUser.emailVerified && !user.isEmailVerified) {
    user.isEmailVerified = true;
  }
  if (!user.googleId) {
    user.googleId = googleUser.googleId;
    if (user.authProvider === 'local') {
      user.authProvider = 'google';
    }
  }
  await user.save();
  return user;
};

const sendAuthSuccess = (res, user, message, status = 200) =>
  sendAuthResponse(res, user, message, status);

export const googleAuth = async (req, res) => {
  try {
    const {
      credential,
      role,
      mode,
      profileImage,
      shopName,
      shopLocation,
      shopImage,
    } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    if (!mode || !['login', 'register'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid auth mode' });
    }

    if (mode === 'register' && (!role || !['shopkeeper', 'customer'].includes(role))) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }

    let googleUser;
    try {
      googleUser = await verifyGoogleToken(credential);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google sign-in. Please try again.',
      });
    }

    const byGoogleId = await User.findOne({ googleId: googleUser.googleId });

    if (mode === 'login') {
      let user = byGoogleId;

      if (!user) {
        const byEmail = await User.find({ email: googleUser.email });
        if (!byEmail.length) {
          return res.status(404).json({
            success: false,
            message: 'No account found with this Google account. Please register first.',
          });
        }

        user =
          byEmail.find((candidate) => isAdminEmail(candidate.email)) ||
          byEmail.find((candidate) => candidate.role === 'shopkeeper') ||
          byEmail[0];
      }

      await linkGoogleToUser(user, googleUser, profileImage);
      if (user.role === 'customer') {
        notifyPendingInvitationsForUser(user).catch((error) => {
          console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
        });
      }
      return sendAuthSuccess(res, user, 'Login successful');
    }

    if (!role || !['shopkeeper', 'customer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }

    const byEmail = await User.findOne({ email: googleUser.email, role });

    if (byGoogleId && byEmail && byGoogleId._id.toString() !== byEmail._id.toString()) {
      return res.status(409).json({
        success: false,
        message: 'This Google account and email belong to different BakiBook accounts. Contact support.',
      });
    }

    let user = byGoogleId || byEmail;

    if (user && user.role !== role) {
      return res.status(409).json({
        success: false,
        message: `An account with this email exists as a ${user.role}. Please register with the matching account type.`,
      });
    }

    // Register mode — if account already exists, link Google and sign in
    if (user) {
      const hadGoogle = Boolean(user.googleId);
      await linkGoogleToUser(user, googleUser, profileImage);
      if (user.role === 'customer') {
        notifyPendingInvitationsForUser(user).catch((error) => {
          console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
        });
      }
      return sendAuthSuccess(
        res,
        user,
        hadGoogle ? 'Signed in with Google' : 'Google account linked — signed in successfully'
      );
    }

    const emailCheck = await assertEmailAvailableForRole(googleUser.email, role);
    if (!emailCheck.ok) {
      return res.status(emailCheck.status).json({ success: false, message: emailCheck.message });
    }

    const resolvedProfileImage = await resolveImageUrl(
      profileImage || googleUser.picture,
      'profiles'
    );
    const resolvedShopImage =
      role === 'shopkeeper' ? await resolveImageUrl(shopImage, 'shops') : '';

    try {
      user = await User.create({
        role,
        fullName: googleUser.fullName,
        profileImage: resolvedProfileImage,
        email: googleUser.email,
        shopName: role === 'shopkeeper' ? (shopName?.trim() || '') : '',
        shopLocation: role === 'shopkeeper' ? (shopLocation?.trim() || '') : '',
        shopImage: resolvedShopImage,
        googleId: googleUser.googleId,
        authProvider: 'google',
        isEmailVerified: googleUser.emailVerified !== false,
        shopVerificationStatus: 'incomplete',
        isShopVerified: false,
      });
    } catch (createError) {
      // Race: double submit (e.g. React StrictMode) may create user on first request
      if (createError.code === 11000) {
        user = await User.findOne({
          $or: [
            { email: googleUser.email, role },
            { googleId: googleUser.googleId },
          ],
        });

        if (user && user.role === role) {
          await linkGoogleToUser(user, googleUser, profileImage);
          if (user.role === 'customer') {
            notifyPendingInvitationsForUser(user).catch((error) => {
              console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
            });
          }
          return sendAuthSuccess(res, user, 'Signed in with Google');
        }

        return res.status(409).json({
          success: false,
          message:
            'This email is already registered under a different account type. Use Login with the correct account type.',
        });
      }
      throw createError;
    }

    sendWelcomeEmail(user).catch((error) => {
      console.error(`Failed to send welcome email to ${user.email}:`, error.message);
    });

    if (role === 'customer') {
      notifyPendingInvitationsForUser(user).catch((error) => {
        console.error(`Failed to notify pending invitations for ${user.email}:`, error.message);
      });
    } else if (role === 'shopkeeper' && isShopDetailsComplete(user)) {
      user.shopVerificationStatus = 'pending';
      user.isShopVerified = false;
      await user.save();
      notifyAdminsShopPending(user).catch((error) => {
        console.error('Failed to notify admins about shop verification:', error.message);
      });
    }

    return sendAuthSuccess(res, user, 'Account created successfully with Google!', 201);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Google authentication failed',
    });
  }
};

export const completeShopProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'shopkeeper') {
      return res.status(403).json({ success: false, message: 'Only shopkeepers can update shop details' });
    }

    const { shopName, shopLocation, shopImage } = req.body;

    if (!shopName?.trim()) {
      return res.status(400).json({ success: false, message: 'Shop name is required' });
    }

    if (!shopLocation?.trim()) {
      return res.status(400).json({ success: false, message: 'Shop location is required' });
    }

    if (!shopImage) {
      return res.status(400).json({ success: false, message: 'Shop image is required' });
    }

    user.shopName = shopName.trim();
    user.shopLocation = shopLocation.trim();
    user.shopImage = await resolveImageUrl(shopImage, 'shops');
    await applyShopVerificationState(user);
    await user.save();

    return res.json({
      success: true,
      message: 'Shop details submitted for admin verification',
      user: formatUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Phone number is already registered' });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save shop details',
    });
  }
};

export const requestEmailChange = async (req, res) => {
  const newEmail = String(req.body.newEmail || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  try {
    const user = await User.findById(req.user._id).select(
      '+password +pendingEmail +emailChangeCodeHash +emailChangeExpires ' +
        '+emailChangeRequestedAt +emailChangePasswordAttempts +emailChangeLockedUntil'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const now = Date.now();
    if (user.emailChangeLockedUntil && user.emailChangeLockedUntil.getTime() > now) {
      return res.status(429).json({
        success: false,
        message: 'Email changes are locked for 24 hours after three incorrect password attempts',
        lockedUntil: user.emailChangeLockedUntil,
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Enter your password to continue',
      });
    }
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation is unavailable for this account',
      });
    }

    const passwordMatches = await user.matchPassword(password);
    if (!passwordMatches) {
      const attempts = (user.emailChangePasswordAttempts || 0) + 1;
      if (attempts >= 3) {
        user.emailChangePasswordAttempts = 0;
        user.emailChangeLockedUntil = new Date(now + 24 * 60 * 60 * 1000);
        user.pendingEmail = undefined;
        user.emailChangeCodeHash = undefined;
        user.emailChangeExpires = undefined;
        user.emailChangeRequestedAt = undefined;
        await user.save();
        return res.status(429).json({
          success: false,
          message: 'Incorrect password three times. Email changes are locked for 24 hours.',
          lockedUntil: user.emailChangeLockedUntil,
          remainingAttempts: 0,
        });
      }

      user.emailChangePasswordAttempts = attempts;
      await user.save();
      const remainingAttempts = 3 - attempts;
      return res.status(401).json({
        success: false,
        message: `Incorrect password. ${remainingAttempts} ${
          remainingAttempts === 1 ? 'attempt' : 'attempts'
        } remaining.`,
        remainingAttempts,
      });
    }

    user.emailChangePasswordAttempts = 0;
    user.emailChangeLockedUntil = undefined;
    await user.save();

    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (newEmail === user.email) {
      return res.status(400).json({
        success: false,
        message: 'This is already your current email address',
      });
    }

    const existing = await User.exists({ email: newEmail, _id: { $ne: user._id } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    if (
      user.pendingEmail === newEmail &&
      user.emailChangeRequestedAt &&
      now - user.emailChangeRequestedAt.getTime() < 60_000
    ) {
      return res.status(429).json({
        success: false,
        message: 'Please wait one minute before requesting another code',
      });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    user.pendingEmail = newEmail;
    user.emailChangeCodeHash = hashToken(code);
    user.emailChangeExpires = new Date(now + 10 * 60 * 1000);
    user.emailChangeRequestedAt = new Date(now);
    await user.save();

    try {
      await sendEmailChangeCode(user, newEmail, code);
    } catch (emailError) {
      user.pendingEmail = undefined;
      user.emailChangeCodeHash = undefined;
      user.emailChangeExpires = undefined;
      user.emailChangeRequestedAt = undefined;
      await user.save();
      return res.status(502).json({
        success: false,
        message: 'Could not send the confirmation code. Please try again.',
      });
    }

    return res.json({
      success: true,
      message: 'Confirmation code sent to your new email',
      pendingEmail: newEmail,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to request email change',
    });
  }
};

export const confirmEmailChange = async (req, res) => {
  const code = String(req.body.code || '').trim();

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message: 'Enter the 6-digit confirmation code',
    });
  }

  try {
    const user = await User.findById(req.user._id).select(
      '+pendingEmail +emailChangeCodeHash +emailChangeExpires +emailChangeRequestedAt ' +
        '+emailChangeLockedUntil'
    );
    if (user?.emailChangeLockedUntil && user.emailChangeLockedUntil.getTime() > Date.now()) {
      return res.status(429).json({
        success: false,
        message: 'Email changes are locked for 24 hours after three incorrect password attempts',
        lockedUntil: user.emailChangeLockedUntil,
      });
    }
    if (!user?.pendingEmail || !user.emailChangeCodeHash || !user.emailChangeExpires) {
      return res.status(400).json({
        success: false,
        message: 'Request a new confirmation code first',
      });
    }
    if (user.emailChangeExpires.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation code has expired. Request a new code.',
      });
    }

    const submittedHash = hashToken(code);
    const expected = Buffer.from(user.emailChangeCodeHash, 'hex');
    const submitted = Buffer.from(submittedHash, 'hex');
    if (
      expected.length !== submitted.length ||
      !crypto.timingSafeEqual(expected, submitted)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect confirmation code',
      });
    }

    const existing = await User.exists({
      email: user.pendingEmail,
      _id: { $ne: user._id },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    user.email = user.pendingEmail;
    user.isEmailVerified = true;
    user.pendingEmail = undefined;
    user.emailChangeCodeHash = undefined;
    user.emailChangeExpires = undefined;
    user.emailChangeRequestedAt = undefined;
    await user.save();

    if (user.role === 'customer') {
      await notifyPendingInvitationsForUser(user).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Email changed successfully',
      user: formatUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm email change',
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const {
      fullName,
      phone,
      profileImage,
      password,
      shopName,
      shopLocation,
      shopImage,
      preferredLanguage,
    } = req.body;

    if (fullName?.trim()) {
      user.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      const cleaned = String(phone || '').trim();
      if (cleaned) {
        const digits = cleaned.replace(/[^\d+]/g, '');
        if (digits.replace(/\D/g, '').length < 7 || digits.replace(/\D/g, '').length > 15) {
          return res.status(400).json({
            success: false,
            message: 'Enter a valid phone number',
          });
        }
        user.phone = digits;
      } else {
        user.phone = undefined;
      }
    }

    if (preferredLanguage === 'en' || preferredLanguage === 'ne') {
      user.preferredLanguage = preferredLanguage;
    }

    if (profileImage) {
      user.profileImage = await resolveImageUrl(profileImage, 'profiles');
    }

    // Password changes must go through /change-password (requires current password).
    if (password) {
      return res.status(400).json({
        success: false,
        message: 'Use change password to update your password',
      });
    }

    if (user.role === 'shopkeeper') {
      let shopChanged = false;

      if (shopName !== undefined) {
        user.shopName = shopName.trim();
        shopChanged = true;
      }
      if (shopLocation !== undefined) {
        user.shopLocation = shopLocation.trim();
        shopChanged = true;
      }
      if (shopImage) {
        user.shopImage = await resolveImageUrl(shopImage, 'shops');
        shopChanged = true;
      }

      if (shopChanged) {
        await applyShopVerificationState(user);
      }
    }

    await user.save();

    const shopSubmitted =
      user.role === 'shopkeeper' &&
      resolveShopVerificationStatus(user) === 'pending' &&
      isShopDetailsComplete(user);

    return res.json({
      success: true,
      message: shopSubmitted
        ? 'Shop details submitted for admin verification'
        : 'Profile updated successfully',
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile',
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google sign-in. Set a password via email reset on the web app.',
      });
    }

    const matches = await user.matchPassword(currentPassword);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to change password',
    });
  }
};

export const updateTutorialProgress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'shopkeeper') {
      return res.status(403).json({
        success: false,
        message: 'Tutorial progress is only available for shopkeepers',
      });
    }

    const { stepId, completed, completedStepIds, reset } = req.body;
    const current = sanitizeTutorialStepIds(user.tutorialProgress?.completedStepIds || []);
    let next = [...current];

    if (reset === true) {
      next = [];
    } else if (Array.isArray(completedStepIds)) {
      next = sanitizeTutorialStepIds(completedStepIds);
    } else if (typeof stepId === 'string') {
      if (!TUTORIAL_STEP_ID_SET.has(stepId)) {
        return res.status(400).json({ success: false, message: 'Unknown tutorial step' });
      }
      const set = new Set(next);
      if (completed === false) {
        set.delete(stepId);
      } else {
        set.add(stepId);
      }
      next = [...set];
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide stepId, completedStepIds, or reset',
      });
    }

    user.tutorialProgress = {
      completedStepIds: next,
      updatedAt: new Date(),
    };
    await user.save();

    return res.json({
      success: true,
      message: 'Tutorial progress updated',
      user: formatUser(user),
      tutorialProgress: formatTutorialProgress(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tutorial progress',
    });
  }
};
