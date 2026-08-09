import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import SystemSetting from '../models/SystemSetting.js';
import { createNotification } from '../utils/notify.js';
import { getAdminEmails } from '../utils/adminCheck.js';

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

const shopkeeperFilter = () => ({
  role: 'shopkeeper',
  ...nonAdminFilter(),
});

export const getAdminDashboard = async (_req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const excludeAdmins = nonAdminFilter();

    const [shopkeepers, customers, users, creditAgg, txToday] = await Promise.all([
      User.countDocuments(shopkeeperFilter()),
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

export const getAdminShops = async (_req, res) => {
  try {
    const shopkeepers = await User.find(shopkeeperFilter()).sort({ createdAt: -1 });

    const shops = await Promise.all(
      shopkeepers.map(async (sk) => {
        const [customerCount, outstandingAgg] = await Promise.all([
          Customer.countDocuments({ shopkeeper: sk._id }),
          Customer.aggregate([
            { $match: { shopkeeper: sk._id } },
            { $group: { _id: null, total: { $sum: '$balance' } } },
          ]),
        ]);

        return {
          id: sk._id.toString(),
          name: sk.shopName || 'Unnamed Shop',
          owner: sk.fullName,
          ownerEmail: sk.email,
          location: sk.shopLocation || '—',
          shopImage: sk.shopImage || '',
          customers: customerCount,
          outstanding: outstandingAgg[0]?.total || 0,
          verificationStatus: resolveShopStatus(sk),
          status: resolveShopStatus(sk),
        };
      })
    );

    res.json({ success: true, shops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUsers = async (_req, res) => {
  try {
    const users = await User.find(nonAdminFilter()).sort({ createdAt: -1 }).select('-password');

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.fullName,
        email: u.email,
        role: u.role,
        shop: u.role === 'shopkeeper' ? u.shopName || '—' : '—',
        status: u.isEmailVerified ? 'active' : 'pending',
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      User.countDocuments(shopkeeperFilter()),
      User.countDocuments({ role: 'customer', ...nonAdminFilter() }),
      User.countDocuments(nonAdminFilter()),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.countDocuments(),
      User.find(shopkeeperFilter()).select('shopName fullName shopVerificationStatus isShopVerified'),
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
    const shopkeeper = await User.findOne({ _id: req.params.id, role: 'shopkeeper' });

    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
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
    const shopkeeper = await User.findOne({ _id: req.params.id, role: 'shopkeeper' });

    if (!shopkeeper) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
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
      User.countDocuments(shopkeeperFilter()),
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

const formatMaintenanceSettings = (settings) => ({
  maintenanceMode: Boolean(settings.maintenanceMode),
  maintenanceMessage:
    settings.maintenanceMessage ||
    'BakiBook is temporarily unavailable. Please check back soon.',
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
    const { maintenanceMode, maintenanceMessage } = req.body;
    if (typeof maintenanceMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'maintenanceMode must be a boolean',
      });
    }

    const settings = await SystemSetting.getGlobal();
    settings.maintenanceMode = maintenanceMode;
    if (typeof maintenanceMessage === 'string') {
      const trimmed = maintenanceMessage.trim();
      if (trimmed) settings.maintenanceMessage = trimmed;
    }
    settings.updatedBy = req.user?._id || null;
    await settings.save();

    res.json({
      success: true,
      message: maintenanceMode
        ? 'Maintenance mode enabled'
        : 'Maintenance mode disabled',
      settings: formatMaintenanceSettings(settings),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
