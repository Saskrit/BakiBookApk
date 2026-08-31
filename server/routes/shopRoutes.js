import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { shopkeeperOnly } from '../middleware/roleMiddleware.js';
import {
  getDashboardStats,
  getReport,
  getAnalytics,
  getShopActivity,
} from '../controllers/dashboardController.js';
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import {
  inviteShopTeamMember,
  listShopTeam,
  revokeShopTeamMember,
} from '../controllers/shopTeamController.js';
import { exportShopBackup, restoreShopBackup } from '../controllers/backupController.js';
import { requireShopOwner } from '../utils/shopContext.js';

const router = express.Router();

router.use(protect, shopkeeperOnly);

router.get('/dashboard', getDashboardStats);
router.get('/products', listProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.get('/activity', getShopActivity);
router.get('/reports', getReport);
router.get('/analytics', getAnalytics);

router.get('/team', listShopTeam);
router.post('/team/invite', inviteShopTeamMember);
router.delete('/team/:memberId', revokeShopTeamMember);

router.get('/backup', requireShopOwner, exportShopBackup);
router.post('/backup/restore', requireShopOwner, restoreShopBackup);

export default router;
