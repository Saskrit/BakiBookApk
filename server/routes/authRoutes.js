import express from 'express';
import {
  registerUser,
  loginUser,
  googleAuth,
  completeShopProfile,
  updateProfile,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  requestEmailChange,
  confirmEmailChange,
  forgotPassword,
  resetPassword,
  changePassword,
  updateTutorialProgress,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.patch('/shop-profile', protect, completeShopProfile);
router.patch('/profile', protect, updateProfile);
router.patch('/tutorial', protect, updateTutorialProgress);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, resendVerificationEmail);
router.post('/change-email/request', protect, requestEmailChange);
router.post('/change-email/confirm', protect, confirmEmailChange);
router.post('/change-password', protect, changePassword);
router.get('/me', protect, getMe);

export default router;
