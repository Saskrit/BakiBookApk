import express from 'express';
import { verifyEmailByToken, renderVerifyEmailHtml } from '../utils/emailVerification.js';

const router = express.Router();

const serveVerifyPage = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;
    const result = await verifyEmailByToken(token);

    if (result.ok) {
      return res.type('html').send(
        renderVerifyEmailHtml({
          success: true,
          message: result.message,
        })
      );
    }

    return res.status(400).type('html').send(
      renderVerifyEmailHtml({
        success: false,
        message: result.message,
      })
    );
  } catch (error) {
    return res.status(500).type('html').send(
      renderVerifyEmailHtml({
        success: false,
        message: error.message || 'Email verification failed. Please try again.',
      })
    );
  }
};

router.get('/', serveVerifyPage);
router.get('/:token', serveVerifyPage);

export default router;
