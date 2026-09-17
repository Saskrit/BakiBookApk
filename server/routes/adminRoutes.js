import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import {
  getAdminDashboard,
  getAdminShops,
  getAdminUsers,
  getAdminUserById,
  getAdminAnalytics,
  verifyShop,
  rejectShop,
  updateAdminUserStatus,
  deleteAdminUser,
  resetAdminUserPassword,
  getMaintenanceSettings,
  updateMaintenanceSettings,
  getAdminPaymentSubmissions,
  acceptAdminPaymentSubmission,
  rejectAdminPaymentSubmission,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/dashboard', getAdminDashboard);
router.get('/shops', getAdminShops);
router.patch('/shops/:id/verify', verifyShop);
router.patch('/shops/:id/reject', rejectShop);
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserById);
router.patch('/users/:id/status', updateAdminUserStatus);
router.patch('/users/:id/password', resetAdminUserPassword);
router.delete('/users/:id', deleteAdminUser);
router.get('/payments', getAdminPaymentSubmissions);
router.patch('/payments/:id/accept', acceptAdminPaymentSubmission);
router.patch('/payments/:id/reject', rejectAdminPaymentSubmission);
router.get('/analytics', getAdminAnalytics);
router.get('/maintenance', getMaintenanceSettings);
router.patch('/maintenance', updateMaintenanceSettings);

export default router;
