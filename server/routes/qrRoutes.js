import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getMyQr, previewQr, connectQr } from '../controllers/qrController.js';

const router = express.Router();

router.use(protect);

router.get('/me', getMyQr);
router.post('/preview', previewQr);
router.post('/connect', connectQr);

export default router;
