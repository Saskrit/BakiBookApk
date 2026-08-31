import express from 'express';
import {
  registerUser,
  verifyRegistration,
  resendRegistrationCode,
  loginUser,
  activateInviteLogin,
  resendInviteLoginCode,
  googleAuth,
  completeShopProfile,
  updateProfile,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  resendVerificationLink,
  requestEmailChange,
  confirmEmailChange,
  forgotPassword,
  resetPassword,
  changePassword,
  updateTutorialProgress,
  registerPushToken,
  unregisterPushToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/register/verify', verifyRegistration);
router.post('/register/resend-code', resendRegistrationCode);
router.post('/login', loginUser);
router.post('/invite/activate', activateInviteLogin);
router.post('/invite/resend-code', resendInviteLoginCode);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.patch('/shop-profile', protect, completeShopProfile);
router.patch('/profile', protect, updateProfile);
router.patch('/tutorial', protect, updateTutorialProgress);
router.get('/verify-email/:token', verifyEmail);
// Legacy unverified accounts (pre code-signup): public + authenticated link resend
router.post('/resend-verification-link', resendVerificationLink);
router.post('/resend-verification', protect, resendVerificationEmail);
router.post('/change-email/request', protect, requestEmailChange);
router.post('/change-email/confirm', protect, confirmEmailChange);
router.post('/change-password', protect, changePassword);
router.post('/push-token', protect, registerPushToken);
router.delete('/push-token', protect, unregisterPushToken);
router.get('/me', protect, getMe);

export default router;
