import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import { isAdminEmail } from '../utils/adminCheck.js';

const ALLOWED_PREFIXES = [
  '/api/health',
  '/api/stats',
  '/api/maintenance-status',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/admin',
  '/api/legal',
];

const isAllowedDuringMaintenance = (path) => {
  if (path === '/' || path === '/api/health' || path === '/api/stats' || path === '/api/maintenance-status') {
    return true;
  }
  return ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const getBearerUser = async (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.split(' ')[1];
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return User.findById(decoded.id).select('email role');
  } catch {
    return null;
  }
};

export const maintenanceGuard = async (req, res, next) => {
  try {
    if (isAllowedDuringMaintenance(req.path)) {
      return next();
    }

    const settings = await SystemSetting.getGlobal();
    if (!settings.maintenanceMode) {
      return next();
    }

    const user = await getBearerUser(req);
    if (user?.email && isAdminEmail(user.email)) {
      return next();
    }

    return res.status(503).json({
      success: false,
      code: 'MAINTENANCE',
      message:
        settings.maintenanceMessage ||
        'BakiBook is temporarily unavailable. Please check back soon.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check maintenance status',
    });
  }
};
