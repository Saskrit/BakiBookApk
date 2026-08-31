import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ShopMembership from '../models/ShopMembership.js';
import { accountStatusDenial } from '../utils/accountStatus.js';

async function attachShopContext(req) {
  req.shopOwnerId = req.user._id;
  req.teamRole = 'owner';
  req.canEditShop = req.user.role === 'shopkeeper';

  if (req.user.role !== 'shopkeeper') {
    req.canEditShop = false;
    return;
  }

  // Prefer denormalized fields on the user (set at invite time).
  if (req.user.shopOwner && req.user.teamRole && req.user.teamRole !== 'owner') {
    req.shopOwnerId = req.user.shopOwner;
    req.teamRole = req.user.teamRole;
    req.canEditShop = false;
    return;
  }

  const membership = await ShopMembership.findOne({
    member: req.user._id,
    status: 'active',
  })
    .select('shopOwner teamRole')
    .lean();

  if (membership) {
    req.shopOwnerId = membership.shopOwner;
    req.teamRole = membership.teamRole;
    req.canEditShop = false;
  }
}

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // lean() is faster; we rehydrate only fields middleware needs as a plain object.
    const user = await User.findById(decoded.id).select('-password').lean();

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;

    const denial = accountStatusDenial(req.user);
    if (denial) {
      return res.status(denial.status).json({
        success: false,
        code: denial.code,
        message: denial.message,
      });
    }

    await attachShopContext(req);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Not authorized — invalid token' });
  }
};
