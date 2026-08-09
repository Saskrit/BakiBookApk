import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import {
  getAdminDashboard,
  getAdminShops,
  getAdminUsers,
  getAdminAnalytics,
  verifyShop,
  rejectShop,
  getMaintenanceSettings,
  updateMaintenanceSettings,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/dashboard', getAdminDashboard);
router.get('/shops', getAdminShops);
router.patch('/shops/:id/verify', verifyShop);
router.patch('/shops/:id/reject', rejectShop);
router.get('/users', getAdminUsers);
router.get('/analytics', getAdminAnalytics);
router.get('/maintenance', getMaintenanceSettings);
router.patch('/maintenance', updateMaintenanceSettings);

export default router;
