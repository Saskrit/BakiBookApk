import express from 'express';
import multer from 'multer';
import { imageUpload } from '../config/upload.js';
import { protect } from '../middleware/authMiddleware.js';
import { processUploadedFile, removeLocalFile } from '../utils/imageUpload.js';

const router = express.Router();

router.post('/:type', protect, (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image must be smaller than 5MB' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }

    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    next();
  });
}, async (req, res) => {
  try {
    const { type } = req.params;

    if (!['profile', 'shop', 'payment'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid upload type' });
    }

    if (type === 'shop' && req.user.role !== 'shopkeeper') {
      return res.status(403).json({ success: false, message: 'Shop images are for shopkeepers only' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const result = await processUploadedFile(req.file, type);

    return res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      url: result.url,
      localUrl: result.localUrl,
      cloudinaryUrl: result.cloudinaryUrl,
    });
  } catch (error) {
    if (req.file?.path) {
      await removeLocalFile(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Image upload failed',
    });
  }
});

export default router;
