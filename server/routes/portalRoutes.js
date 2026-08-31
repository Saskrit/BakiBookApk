import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { customerOnly } from '../middleware/roleMiddleware.js';
import {
  getPortalDashboard,
  getPortalLedger,
  getPortalShopDetail,
  getPortalTransactions,
  getPortalPayments,
  getPortalDues,
  getPortalNotifications,
  exportCustomerBackup,
} from '../controllers/portalController.js';
import {
  submitPayment,
  listCustomerSubmissions,
} from '../controllers/paymentSubmissionController.js';

const router = express.Router();

router.use(protect, customerOnly);

router.get('/dashboard', getPortalDashboard);
router.get('/ledger', getPortalLedger);
router.get('/shops/:customerId', getPortalShopDetail);
router.get('/transactions', getPortalTransactions);
router.get('/payments', getPortalPayments);
router.get('/dues', getPortalDues);
router.get('/notifications', getPortalNotifications);
router.get('/payment-submissions', listCustomerSubmissions);
router.post('/payment-submissions', submitPayment);

router.get('/backup', exportCustomerBackup);

export default router;
