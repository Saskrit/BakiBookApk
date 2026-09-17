import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import PaymentSubmission from '../models/PaymentSubmission.js';
import SystemSetting from '../models/SystemSetting.js';
import { createNotification } from '../utils/notify.js';
import { getAdminEmails, isAdminEmail } from '../utils/adminCheck.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { ACCOUNT_STATUSES, resolveAccountStatus } from '../utils/accountStatus.js';
import ShopMembership from '../models/ShopMembership.js';
import { formatPaymentSubmission } from '../utils/formatters.js';
import { applyPayment, generateReceiptNo } from '../utils/customerBalance.js';
import { emitToUser } from '../config/socket.js';
import {
  emitShopDataSync,
  emitUserSync,
  broadcastMaintenance,
} from '../utils/realtimeSync.js';
import { startTransactionSession } from '../utils/mongoSession.js';

const resolveShopStatus = (shopkeeper) => {
  if (shopkeeper.shopVerificationStatus === 'verified' || shopkeeper.isShopVerified) {
    return 'verified';
  }
  if (shopkeeper.shopVerificationStatus === 'pending') return 'pending';
  if (shopkeeper.shopVerificationStatus === 'rejected') return 'rejected';
  return 'incomplete';
};

const nonAdminFilter = () => {
  const adminEmails = getAdminEmails();
  if (!adminEmails.length) return {};
  return { email: { $nin: adminEmails } };
};

/** True shop owners only — excludes partners/staff who share a shop. */
const shopOwnerFilter = () => ({
  role: 'shopkeeper',
  shopOwner: null,
  ...nonAdminFilter(),
});

const isTeamMemberUser = (user) =>
  user.role === 'shopkeeper' &&
  Boolean(user.shopOwner) &&
  (user.teamRole === 'partner' || user.teamRole === 'staff');

const resolveTeamRole = (user) => {
  if (user.role !== 'shopkeeper') return null;
  if (isTeamMemberUser(user)) return user.teamRole;
  return 'owner';
};

export const getAdminDashboard = async (_req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const excludeAdmins = nonAdminFilter();

    const [shopkeepers, customers, users, creditAgg, txToday] = await Promise.all([
      User.countDocuments(shopOwnerFilter()),
      User.countDocuments({ role: 'customer', ...excludeAdmins }),
      User.countDocuments(excludeAdmins),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Transaction.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalShops: shopkeepers,
        activeUsers: users,
        creditManaged: creditAgg[0]?.total || 0,
        transactionsToday: txToday,
        customerAccounts: customers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildShopkeeperStatusFilter = (status) => {
  if (!status || status === 'all') return {};
  if (status === 'verified') {
    return { $or: [{ shopVerificationStatus: 'verified' }, { isShopVerified: true }] };
  }
  return { shopVerificationStatus: status, isShopVerified: { $ne: true } };
};

const mapAdminShop = async (sk) => {
  const [customerCount, outstandingAgg, memberships] = await Promise.all([
    Customer.countDocuments({ shopkeeper: sk._id }),
    Customer.aggregate([
      { $match: { shopkeeper: sk._id } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]),
    ShopMembership.find({ shopOwner: sk._id, status: 'active' })
      .populate('member', 'fullName email phone profileImage teamRole accountStatus isEmailVerified')
      .lean(),
  ]);

  const status = resolveShopStatus(sk);

  return {
    id: sk._id.toString(),
    name: sk.shopName || 'Unnamed Shop',
    owner: sk.fullName,
    ownerEmail: sk.email,
    ownerPhone: sk.phone || '',
    ownerProfileImage: sk.profileImage || '',
    location: sk.shopLocation || '',
    shopImage: sk.shopImage || '',
    customers: customerCount,
    outstanding: outstandingAgg[0]?.total || 0,
    verificationStatus: status,
    status,
    createdAt: sk.createdAt,
    updatedAt: sk.updatedAt,
    team: memberships
      .filter((m) => m.member)
      .map((m) => ({
        id: m.member._id.toString(),
        name: m.member.fullName,
        email: m.member.email,
        phone: m.member.phone || '',
        profileImage: m.member.profileImage || '',
        teamRole: m.teamRole || m.member.teamRole || 'staff',
        accountStatus: resolveAccountStatus(m.member),
        emailVerified: Boolean(m.member.isEmailVerified),
      })),
  };
};

export const getAdminShops = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || 'all').toLowerCase();
    const filter = { ...shopOwnerFilter(), ...buildShopkeeperStatusFilter(status) };

    const [total, shopkeepers] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    const shops = await Promise.all(shopkeepers.map(mapAdminShop));

    res.json({
      success: true,
      shops,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const mapAdminUserListItem = (u, ownerShopNameById = {}) => {
  const accountStatus = resolveAccountStatus(u);
  const teamRole = resolveTeamRole(u);
  const ownerId = u.shopOwner ? String(u.shopOwner) : null;
  const ownerShopName = ownerId ? ownerShopNameById[ownerId] || '' : '';

  let shopLabel = '—';
  if (u.role === 'shopkeeper') {
    if (teamRole === 'partner' || teamRole === 'staff') {
      shopLabel = ownerShopName || 'Team member';
    } else {
      shopLabel = u.shopName || '—';
    }
  }

  return {
    id: u._id.toString(),
    name: u.fullName,
    email: u.email,
    phone: u.phone || '',
    profileImage: u.profileImage || '',
    role: u.role,
    teamRole,
    shopOwnerId: ownerId,
    shop: shopLabel,
    emailVerified: Boolean(u.isEmailVerified),
    phoneVerified: Boolean(u.isPhoneVerified),
    authProvider: u.authProvider || 'local',
    accountStatus,
    accountStatusReason: u.accountStatusReason || '',
    status: accountStatus !== 'active' ? accountStatus : u.isEmailVerified ? 'active' : 'pending',
    createdAt: u.createdAt,
    accountStatusChangedAt: u.accountStatusChangedAt || null,
  };
};

export const getAdminUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || 'all').toLowerCase();
    const role = String(req.query.role || 'all').toLowerCase();

    const filter = { ...nonAdminFilter() };
    if (status === 'active' || status === 'suspended' || status === 'banned') {
      filter.accountStatus = status;
    } else if (status === 'pending') {
      filter.isEmailVerified = false;
      filter.accountStatus = { $nin: ['suspended', 'banned'] };
    }

    if (role === 'customer') {
      filter.role = 'customer';
    } else if (role === 'shopkeeper' || role === 'owner') {
      Object.assign(filter, shopOwnerFilter());
    } else if (role === 'partner' || role === 'staff') {
      filter.role = 'shopkeeper';
      filter.teamRole = role;
      filter.shopOwner = { $ne: null };
    } else if (role === 'team') {
      filter.role = 'shopkeeper';
      filter.teamRole = { $in: ['partner', 'staff'] };
      filter.shopOwner = { $ne: null };
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-password'),
    ]);

    const ownerIds = [
      ...new Set(
        users
          .filter((u) => u.shopOwner)
          .map((u) => String(u.shopOwner))
      ),
    ];
    const owners = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select('shopName fullName')
      : [];
    const ownerShopNameById = Object.fromEntries(
      owners.map((o) => [o._id.toString(), o.shopName || o.fullName || 'Shop'])
    );

    res.json({
      success: true,
      users: users.map((u) => mapAdminUserListItem(u, ownerShopNameById)),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUserById = async (req, res) => {
  try {
    const { user, error } = await findManageableUser(req.params.id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const teamRole = resolveTeamRole(user);
    let ownerShop = null;
    if (user.shopOwner) {
      const owner = await User.findById(user.shopOwner).select(
        'fullName email shopName shopLocation shopImage isShopVerified shopVerificationStatus'
      );
      if (owner) {
        ownerShop = {
          id: owner._id.toString(),
          ownerName: owner.fullName,
          ownerEmail: owner.email,
          shopName: owner.shopName || '',
          shopLocation: owner.shopLocation || '',
          shopImage: owner.shopImage || '',
          verificationStatus: resolveShopStatus(owner),
        };
      }
    }

    let team = [];
    if (user.role === 'shopkeeper' && teamRole === 'owner') {
      const memberships = await ShopMembership.find({ shopOwner: user._id, status: 'active' })
        .populate('member', 'fullName email phone profileImage teamRole accountStatus isEmailVerified')
        .lean();
      team = memberships
        .filter((m) => m.member)
        .map((m) => ({
          id: m.member._id.toString(),
          name: m.member.fullName,
          email: m.member.email,
          phone: m.member.phone || '',
          profileImage: m.member.profileImage || '',
          teamRole: m.teamRole || m.member.teamRole || 'staff',
          accountStatus: resolveAccountStatus(m.member),
          emailVerified: Boolean(m.member.isEmailVerified),
        }));
    }

    const accountStatus = resolveAccountStatus(user);

    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.fullName,
        email: user.email,
        phone: user.phone || '',
        profileImage: user.profileImage || '',
        role: user.role,
        teamRole,
        shopOwnerId: user.shopOwner ? String(user.shopOwner) : null,
        shopName: user.shopName || '',
        shopLocation: user.shopLocation || '',
        shopImage: user.shopImage || '',
        shopVerificationStatus: user.role === 'shopkeeper' ? resolveShopStatus(user) : null,
        isShopVerified: Boolean(user.isShopVerified),
        emailVerified: Boolean(user.isEmailVerified),
        phoneVerified: Boolean(user.isPhoneVerified),
        authProvider: user.authProvider || 'local',
        qrCode: user.qrCode || '',
        preferredLanguage: user.preferredLanguage === 'ne' ? 'ne' : 'en',
        mustChangePassword: Boolean(user.mustChangePassword),
        accountStatus,
        accountStatusReason: user.accountStatusReason || '',
        accountStatusChangedAt: user.accountStatusChangedAt || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ownerShop,
        team,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const findManageableUser = async (id) => {
  const user = await User.findById(id).select('-password');
  if (!user) return { error: { status: 404, message: 'User not found' } };
  if (isAdminEmail(user.email)) {
    return { error: { status: 403, message: 'Admin accounts cannot be managed here' } };
  }
  return { user };
};

export const updateAdminUserStatus = async (req, res) => {
  try {
    const nextStatus = String(req.body?.status || '').toLowerCase();
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!ACCOUNT_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be active, suspended, or banned',
      });
    }

    const { user, error } = await findManageableUser(req.params.id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    user.accountStatus = nextStatus;
    user.accountStatusReason = nextStatus === 'active' ? '' : reason;
    user.accountStatusChangedAt = new Date();
    await user.save();

    if (nextStatus === 'suspended' || nextStatus === 'banned') {
      await createNotification({
        userId: user._id,
        title: nextStatus === 'banned' ? 'Account banned' : 'Account suspended',
        body:
          reason ||
          (nextStatus === 'banned'
            ? 'Your BakiBook account has been banned by an administrator.'
            : 'Your BakiBook account has been suspended by an administrator.'),
        type: 'warning',
        linkPath: '/login',
      }).catch(() => {});
    }

    emitUserSync(user._id, {
      forceLogout: nextStatus === 'suspended' || nextStatus === 'banned',
      accountStatus: resolveAccountStatus(user),
      reason: user.accountStatusReason || '',
    });

    return res.json({
      success: true,
      message:
        nextStatus === 'active'
          ? 'User reactivated'
          : nextStatus === 'suspended'
            ? 'User suspended'
            : 'User banned',
      user: {
        id: user._id.toString(),
        accountStatus: resolveAccountStatus(user),
        accountStatusReason: user.accountStatusReason || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    const { user, error } = await findManageableUser(req.params.id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await ShopMembership.updateMany(
      { $or: [{ member: user._id }, { shopOwner: user._id }] },
      { $set: { status: 'revoked' } }
    );

    emitUserSync(user._id, { forceLogout: true, deleted: true });

    await User.deleteOne({ _id: user._id });

    return res.json({
      success: true,
      message: 'User deleted',
      id: user._id.toString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetAdminUserPassword = async (req, res) => {
  try {
    const { password, mustChangePassword } = req.body;
    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const { user, error } = await findManageableUser(req.params.id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    user.password = password.trim();
    user.mustChangePassword = Boolean(mustChangePassword);
    await user.save();

    await createNotification({
      userId: user._id,
      title: 'Password updated by admin',
      body: 'Your account password was updated by an administrator. Please sign in with your new password.',
      type: 'warning',
      linkPath: '/login',
    }).catch(() => {});

    emitUserSync(user._id, {
      forceLogout: true,
      mustChangePassword: user.mustChangePassword,
    });

    return res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminAnalytics = async (_req, res) => {
  try {
    const monthCount = 6;
    const start = new Date();
    start.setMonth(start.getMonth() - (monthCount - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const monthKeys = [];
    const monthLabels = [];
    for (let i = monthCount - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    const mapAggToSeries = (rows, valueKey = 'total') => {
      const map = Object.fromEntries(rows.map((r) => [r._id, r[valueKey]]));
      return monthKeys.map((key) => map[key] || 0);
    };

    const [
      creditByMonth,
      paymentByMonth,
      txCountByMonth,
      userRegByMonth,
      shopkeepers,
      customers,
      totalUsers,
      creditAgg,
      paymentAgg,
      txTotal,
      shopkeeperUsers,
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$total' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: start }, ...nonAdminFilter() } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments(shopOwnerFilter()),
      User.countDocuments({ role: 'customer', ...nonAdminFilter() }),
      User.countDocuments(nonAdminFilter()),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.countDocuments(),
      User.find(shopOwnerFilter()).select('shopName fullName shopVerificationStatus isShopVerified'),
    ]);

    const shopVerification = { verified: 0, pending: 0, rejected: 0, incomplete: 0 };
    shopkeeperUsers.forEach((sk) => {
      const status = resolveShopStatus(sk);
      shopVerification[status] = (shopVerification[status] || 0) + 1;
    });

    const topShops = await Promise.all(
      shopkeeperUsers.map(async (sk) => {
        const [customerCount, outstandingAgg] = await Promise.all([
          Customer.countDocuments({ shopkeeper: sk._id }),
          Customer.aggregate([
            { $match: { shopkeeper: sk._id } },
            { $group: { _id: null, total: { $sum: '$balance' } } },
          ]),
        ]);
        return {
          name: sk.shopName || sk.fullName || 'Unnamed Shop',
          outstanding: outstandingAgg[0]?.total || 0,
          customers: customerCount,
        };
      })
    );

    topShops.sort((a, b) => b.outstanding - a.outstanding);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const transactionsToday = await Transaction.countDocuments({ createdAt: { $gte: startOfToday } });

    res.json({
      success: true,
      analytics: {
        summary: {
          totalShops: shopkeepers,
          customerAccounts: customers,
          activeUsers: totalUsers,
          creditManaged: creditAgg[0]?.total || 0,
          paymentsCollected: paymentAgg[0]?.total || 0,
          totalTransactions: txTotal,
          transactionsToday,
        },
        monthLabels,
        creditTrend: mapAggToSeries(creditByMonth),
        paymentTrend: mapAggToSeries(paymentByMonth),
        transactionTrend: mapAggToSeries(txCountByMonth, 'total'),
        userGrowth: mapAggToSeries(userRegByMonth, 'total'),
        shopVerification: [
          { label: 'Verified', value: shopVerification.verified, color: '#5C8A4E' },
          { label: 'Pending', value: shopVerification.pending, color: '#C08552' },
          { label: 'Rejected', value: shopVerification.rejected, color: '#B42318' },
          { label: 'Incomplete', value: shopVerification.incomplete, color: '#8A8580' },
        ].filter((item) => item.value > 0),
        userRoles: [
          { label: 'Shopkeepers', value: shopkeepers, color: '#9A6B42' },
          { label: 'Customers', value: customers, color: '#4A6670' },
        ],
        topShops: topShops.slice(0, 5),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyShop = async (req, res) => {
  try {
    const shopkeeper = await User.findOne({
      _id: req.params.id,
      role: 'shopkeeper',
      shopOwner: null,
    });

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found (partners and staff are not shops)',
      });
    }

    shopkeeper.shopVerificationStatus = 'verified';
    shopkeeper.isShopVerified = true;
    await shopkeeper.save();

    await createNotification({
      userId: shopkeeper._id,
      title: 'Shop verified',
      body: `Your shop "${shopkeeper.shopName || 'BakiBook shop'}" has been verified by an admin.`,
      type: 'success',
      linkPath: '/shop/settings',
    });

    await emitShopDataSync(shopkeeper._id, {
      userSync: {
        shopVerificationStatus: 'verified',
        isShopVerified: true,
      },
      scopes: ['shop', 'dashboard', 'all'],
    });

    res.json({
      success: true,
      message: 'Shop verified successfully',
      shop: {
        id: shopkeeper._id.toString(),
        name: shopkeeper.shopName,
        verificationStatus: 'verified',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectShop = async (req, res) => {
  try {
    const shopkeeper = await User.findOne({
      _id: req.params.id,
      role: 'shopkeeper',
      shopOwner: null,
    });

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found (partners and staff are not shops)',
      });
    }

    shopkeeper.shopVerificationStatus = 'rejected';
    shopkeeper.isShopVerified = false;
    await shopkeeper.save();

    await createNotification({
      userId: shopkeeper._id,
      title: 'Shop verification declined',
      body:
        req.body?.reason?.trim() ||
        'Your shop details were declined. Please update your shop profile and submit again.',
      type: 'warning',
      linkPath: '/shop/settings',
    });

    await emitShopDataSync(shopkeeper._id, {
      userSync: {
        shopVerificationStatus: 'rejected',
        isShopVerified: false,
      },
      scopes: ['shop', 'dashboard', 'all'],
    });

    res.json({
      success: true,
      message: 'Shop verification rejected',
      shop: {
        id: shopkeeper._id.toString(),
        name: shopkeeper.shopName,
        verificationStatus: 'rejected',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPlatformStats = async (_req, res) => {
  try {
    const [shopkeepers, txCount, creditAgg] = await Promise.all([
      User.countDocuments(shopOwnerFilter()),
      Transaction.countDocuments(),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
    ]);

    const creditTotal = creditAgg[0]?.total || 0;

    res.json({
      shopkeepers: `${shopkeepers}+`,
      transactions: txCount >= 1000 ? `${Math.floor(txCount / 1000)}K+` : `${txCount}+`,
      creditManaged: creditTotal >= 10000000 ? `Rs. ${(creditTotal / 10000000).toFixed(1)}Cr+` : `Rs. ${creditTotal.toLocaleString('en-NP')}+`,
      satisfaction: '99%',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const DEFAULT_SUPPORT_EMAIL = 'saskreetking@gmail.com';
const DEFAULT_SUPPORT_PHONE = '+977 9703649841';

const formatMaintenanceSettings = (settings) => ({
  maintenanceMode: Boolean(settings.maintenanceMode),
  maintenanceMessage:
    settings.maintenanceMessage ||
    'BakiBook is temporarily unavailable. Please check back soon.',
  supportEmail: settings.supportEmail || DEFAULT_SUPPORT_EMAIL,
  supportPhone: settings.supportPhone || DEFAULT_SUPPORT_PHONE,
  updatedAt: settings.updatedAt,
  updatedBy: settings.updatedBy || null,
});

export const getMaintenanceSettings = async (_req, res) => {
  try {
    const settings = await SystemSetting.getGlobal();
    res.json({
      success: true,
      settings: formatMaintenanceSettings(settings),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenanceSettings = async (req, res) => {
  try {
    const { maintenanceMode, maintenanceMessage, supportEmail, supportPhone } = req.body;
    const settings = await SystemSetting.getGlobal();
    let touched = false;

    if (typeof maintenanceMode === 'boolean') {
      settings.maintenanceMode = maintenanceMode;
      touched = true;
    }

    if (typeof maintenanceMessage === 'string') {
      const trimmed = maintenanceMessage.trim();
      if (trimmed) {
        settings.maintenanceMessage = trimmed;
        touched = true;
      }
    }

    if (typeof supportEmail === 'string') {
      const email = supportEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Enter a valid support email',
        });
      }
      settings.supportEmail = email;
      touched = true;
    }

    if (typeof supportPhone === 'string') {
      const phone = supportPhone.trim();
      if (phone) {
        settings.supportPhone = phone;
        touched = true;
      }
    }

    if (!touched) {
      return res.status(400).json({
        success: false,
        message: 'No settings to update',
      });
    }

    settings.updatedBy = req.user?._id || null;
    await settings.save();
    SystemSetting.invalidateCache();
    // Refresh cache immediately so all workers/requests see the new values.
    await SystemSetting.getGlobal({ forceRefresh: true });

    if (typeof maintenanceMode === 'boolean') {
      broadcastMaintenance(settings);
    }

    const modeChanged = typeof maintenanceMode === 'boolean';
    res.json({
      success: true,
      message: modeChanged
        ? maintenanceMode
          ? 'Maintenance mode enabled'
          : 'Maintenance mode disabled'
        : 'Settings saved',
      settings: formatMaintenanceSettings(settings),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildAdminPayLabel = (submission) => {
  if (submission.payLabel) return submission.payLabel;
  if (submission.payType === 'transaction') return 'Payment for credit transaction';
  if (submission.payType === 'item') {
    return submission.itemName ? `Payment for ${submission.itemName}` : 'Payment for item';
  }
  return 'Custom payment';
};

const emitAdminPendingCount = async (shopkeeperId) => {
  const count = await PaymentSubmission.countDocuments({
    shopkeeper: shopkeeperId,
    status: 'pending',
  });
  emitToUser(String(shopkeeperId), 'payment-submission:count', { count });
};

/** Platform-wide payment submissions for admin review (esp. reported). */
export const getAdminPaymentSubmissions = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || 'reported').toLowerCase();

    const filter = {};
    if (['pending', 'accepted', 'rejected', 'reported'].includes(status)) {
      filter.status = status;
    }

    const [total, submissions, counts] = await Promise.all([
      PaymentSubmission.countDocuments(filter),
      PaymentSubmission.find(filter)
        .populate('customer', 'name phone')
        .populate('shopkeeper', 'shopName fullName email')
        .populate('submittedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PaymentSubmission.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = { pending: 0, accepted: 0, rejected: 0, reported: 0 };
    for (const row of counts) {
      if (row._id && statusCounts[row._id] !== undefined) {
        statusCounts[row._id] = row.count;
      }
    }

    res.json({
      success: true,
      submissions: submissions.map((s) => ({
        ...formatPaymentSubmission(s, {
          customerName: s.customer?.name || '',
          shopName: s.shopkeeper?.shopName || s.shopkeeper?.fullName || 'Shop',
        }),
        shopkeeperId: s.shopkeeper?._id?.toString?.() || s.shopkeeper?.toString?.() || '',
        shopkeeperEmail: s.shopkeeper?.email || '',
        customerPhone: s.customer?.phone || '',
        submittedByName: s.submittedBy?.fullName || '',
        submittedByEmail: s.submittedBy?.email || '',
      })),
      statusCounts,
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Accept a pending/reported submission and record the payment (admin). */
export const acceptAdminPaymentSubmission = async (req, res) => {
  const session = await startTransactionSession();

  try {
    const reviewNote = req.body.note?.trim() || 'Accepted by admin';
    const existing = await PaymentSubmission.findById(req.params.id)
      .populate('customer', 'name linkedUser linkStatus')
      .session(session);

    if (!existing) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (existing.status === 'accepted' && existing.payment) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: 'Payment already accepted',
        submission: formatPaymentSubmission(existing, {
          customerName: existing.customer?.name,
        }),
        paymentId: existing.payment.toString(),
      });
    }

    if (!['pending', 'reported'].includes(existing.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Submission is already ${existing.status}`,
      });
    }

    const shopkeeperId = existing.shopkeeper;
    const claimed = await PaymentSubmission.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ['pending', 'reported'] },
      },
      {
        $set: {
          status: 'accepted',
          reviewedAt: new Date(),
          reviewNote,
        },
      },
      { new: true, session }
    ).populate('customer', 'name linkedUser linkStatus');

    if (!claimed) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Submission was already processed',
      });
    }

    const customer = claimed.customer;
    const receiptNo = await generateReceiptNo(shopkeeperId);
    const payLabel = buildAdminPayLabel(claimed);
    const noteParts = [claimed.note, payLabel, 'Admin review'].filter(Boolean);

    const [payment] = await Payment.create(
      [
        {
          shopkeeper: claimed.shopkeeper,
          customer: customer._id,
          amount: claimed.amount,
          method: claimed.method,
          note: noteParts.join(' | '),
          receiptNo,
          screenshotUrl: claimed.screenshotUrl,
          payType: claimed.payType,
          transaction: claimed.transaction,
          itemIndex: claimed.itemIndex ?? null,
          itemName: claimed.itemName || '',
          payLabel,
          submission: claimed._id,
        },
      ],
      { session }
    );

    await applyPayment(customer._id, claimed.amount, session);
    claimed.payment = payment._id;
    await claimed.save({ session });
    await session.commitTransaction();

    if (customer.linkedUser) {
      await createNotification({
        userId: customer.linkedUser,
        title: 'Payment accepted',
        body: `Your Rs. ${claimed.amount.toLocaleString('en-NP')} payment was accepted by admin.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        type: 'success',
        customerId: customer._id,
      });
      emitToUser(customer.linkedUser.toString(), 'payment-submission:updated', {
        submissionId: claimed._id.toString(),
        status: 'accepted',
        customerId: customer._id.toString(),
        paymentId: payment._id.toString(),
      });
    }

    await createNotification({
      userId: shopkeeperId,
      title: 'Payment accepted by admin',
      body: `${customer.name} payment of Rs. ${claimed.amount.toLocaleString('en-NP')} was accepted by admin.`,
      type: 'success',
      customerId: customer._id,
      linkPath: `/shop/payments/${payment._id}`,
    });

    await emitAdminPendingCount(shopkeeperId);
    await emitShopDataSync(shopkeeperId, {
      scopes: ['dashboard', 'customers', 'payments', 'all'],
    });

    res.json({
      success: true,
      message: 'Payment accepted and balance updated',
      submission: formatPaymentSubmission(claimed, { customerName: customer.name }),
      paymentId: payment._id.toString(),
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

/** Reject a pending/reported submission (admin). */
export const rejectAdminPaymentSubmission = async (req, res) => {
  try {
    const reviewNote = req.body.note?.trim() || '';
    if (!reviewNote) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const submission = await PaymentSubmission.findOne({
      _id: req.params.id,
      status: { $in: ['pending', 'reported'] },
    }).populate('customer', 'name linkedUser linkStatus');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Pending or reported submission not found',
      });
    }

    submission.status = 'rejected';
    submission.reviewedAt = new Date();
    submission.reviewNote = reviewNote;
    await submission.save();

    const customer = submission.customer;
    const shopkeeperId = submission.shopkeeper;

    if (customer?.linkedUser) {
      await createNotification({
        userId: customer.linkedUser,
        title: 'Payment rejected',
        body: `Your Rs. ${submission.amount.toLocaleString('en-NP')} payment was rejected by admin. Note: ${reviewNote}`,
        type: 'warning',
        customerId: customer._id,
      });
      emitToUser(customer.linkedUser.toString(), 'payment-submission:updated', {
        submissionId: submission._id.toString(),
        status: 'rejected',
        customerId: customer._id.toString(),
        paymentId: null,
      });
    }

    await createNotification({
      userId: shopkeeperId,
      title: 'Payment rejected by admin',
      body: `${customer?.name || 'Customer'} payment of Rs. ${submission.amount.toLocaleString('en-NP')} was rejected by admin.`,
      type: 'warning',
      customerId: customer?._id,
    });

    await emitAdminPendingCount(shopkeeperId);
    await emitShopDataSync(shopkeeperId, {
      scopes: ['dashboard', 'customers', 'payments', 'all'],
    });

    res.json({
      success: true,
      message: 'Payment submission rejected',
      submission: formatPaymentSubmission(submission, {
        customerName: customer?.name,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
