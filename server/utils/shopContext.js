/** Resolve which shopkeeper User id owns shop data for this request. */
export const getShopkeeperId = (req) => req.shopOwnerId || req.user?._id;

export const requireShopOwner = (req, res, next) => {
  if (!req.canEditShop) {
    return res.status(403).json({
      success: false,
      message: 'Only the shop owner can change shop details or manage the team',
    });
  }
  return next();
};

/** Whether the shop (owner account) is admin-verified. */
export async function isRequestShopVerified(req) {
  const ownerId = getShopkeeperId(req);
  if (!ownerId) return false;

  if (req.user && String(req.user._id) === String(ownerId)) {
    return (
      req.user.shopVerificationStatus === 'verified' || req.user.isShopVerified === true
    );
  }

  const User = (await import('../models/User.js')).default;
  const owner = await User.findById(ownerId).select('isShopVerified shopVerificationStatus');
  if (!owner) return false;
  return owner.shopVerificationStatus === 'verified' || owner.isShopVerified === true;
}
