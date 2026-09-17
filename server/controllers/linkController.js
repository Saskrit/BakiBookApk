import Customer from '../models/Customer.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import { formatCustomer, formatDate } from '../utils/formatters.js';
import { buildGroupedLedger } from '../utils/groupedLedger.js';
import { createNotification } from '../utils/notify.js';
import { toPublicImageUrl } from '../utils/imageUpload.js';

const formatPendingLink = (customer) => {
  const base = formatCustomer(customer);
  const shopkeeper = customer.shopkeeper;
  const shopVerificationStatus =
    shopkeeper?.shopVerificationStatus ||
    (shopkeeper?.isShopVerified ? 'verified' : 'incomplete');

  return {
    ...base,
    shopkeeperId: shopkeeper?._id?.toString() || shopkeeper?.toString(),
    shopName: shopkeeper?.shopName || 'Shop',
    shopkeeperName: shopkeeper?.fullName || 'Shopkeeper',
    shopLocation: shopkeeper?.shopLocation || '',
    shopImage: toPublicImageUrl(shopkeeper?.shopImage || ''),
    shopkeeperPhone: shopkeeper?.phone || '',
    shopVerificationStatus,
    shopVerified: shopVerificationStatus === 'verified',
    invitedAt: formatDate(customer.createdAt),
  };
};

export const getPendingLinkDetail = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only' });
    }

    const customer = await Customer.findOne({
      _id: req.params.customerId,
      email: req.user.email?.toLowerCase(),
      linkStatus: 'pending',
      linkedUser: null,
    }).populate('shopkeeper', 'fullName shopName shopLocation shopImage shopVerificationStatus isShopVerified phone');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    const shopName = customer.shopkeeper?.shopName || 'Shop';
    const [transactions, payments, creditAgg, paymentAgg, lastPaymentDoc] = await Promise.all([
      Transaction.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(200),
      Payment.find({ customer: customer._id })
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: -1 })
        .limit(200),
      Transaction.aggregate([
        { $match: { customer: customer._id } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { customer: customer._id } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.findOne({ customer: customer._id }).sort({ createdAt: -1 }),
    ]);

    const ledger = buildGroupedLedger({
      transactions,
      payments,
      role: 'customer',
      filter: 'active',
      shopName,
    });

    const recentPurchaseItems = [];
    for (const tx of transactions) {
      const items = Array.isArray(tx.items) ? tx.items : [];
      for (const item of items) {
        if (item?.name && recentPurchaseItems.length < 12) {
          recentPurchaseItems.push({
            name: item.name,
            qty: item.qty || 1,
            price: item.price || 0,
          });
        }
      }
      if (recentPurchaseItems.length >= 12) break;
    }

    res.json({
      success: true,
      invitation: {
        ...formatPendingLink(customer),
        summary: {
          currentDue: customer.balance || 0,
          totalPurchases: creditAgg[0]?.total || 0,
          totalPaid: paymentAgg[0]?.total || 0,
          creditCount: creditAgg[0]?.count || 0,
          paymentCount: paymentAgg[0]?.count || 0,
          transactionCount: (creditAgg[0]?.count || 0) + (paymentAgg[0]?.count || 0),
          lastPaymentAmount: lastPaymentDoc?.amount || 0,
          lastPaymentDate: lastPaymentDoc ? formatDate(lastPaymentDoc.createdAt) : null,
          lastCreditDate: customer.lastCreditDate ? formatDate(customer.lastCreditDate) : null,
        },
        recentPurchaseItems,
        ledger,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingLinks = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only' });
    }

    const email = req.user.email?.toLowerCase();
    const pending = await Customer.find({
      email,
      linkStatus: 'pending',
      linkedUser: null,
    }).populate('shopkeeper', 'fullName shopName shopLocation shopImage shopVerificationStatus isShopVerified phone');

    res.json({
      success: true,
      count: pending.length,
      invitations: pending.map(formatPendingLink),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptLink = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only' });
    }

    const emailVerified = !!(req.user.isEmailVerified || req.user.authProvider === 'google');
    if (!emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Verify your email before accepting a shop invitation',
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.customerId,
      email: req.user.email?.toLowerCase(),
      linkStatus: 'pending',
      linkedUser: null,
    }).populate('shopkeeper', 'fullName shopName');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    customer.linkedUser = req.user._id;
    customer.linkStatus = 'linked';
    await customer.save();

    await createNotification({
      userId: customer.shopkeeper._id,
      title: 'Customer linked',
      body: `${req.user.fullName} accepted your shop customer invitation.`,
      type: 'success',
      customerId: customer._id,
      linkPath: `/shop/customers/${customer._id}`,
    });

    res.json({ success: true, customer: formatCustomer(customer) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectLink = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only' });
    }

    const customer = await Customer.findOneAndUpdate(
      {
        _id: req.params.customerId,
        email: req.user.email?.toLowerCase(),
        linkStatus: 'pending',
        linkedUser: null,
      },
      { linkStatus: 'rejected' },
      { new: true }
    ).populate('shopkeeper', 'fullName shopName');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    res.json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLinkedShops = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only' });
    }

    const linked = await Customer.find({
      linkedUser: req.user._id,
      linkStatus: 'linked',
    }).populate('shopkeeper', 'fullName shopName shopLocation shopImage shopVerificationStatus isShopVerified phone');

    res.json({
      success: true,
      shops: linked.map(formatPendingLink),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const notifyCustomerOnCreate = async (customer, shopkeeper) => {
  if (!customer.email || customer.linkStatus !== 'pending') return;

  const user = await User.findOne({ email: customer.email, role: 'customer' });
  if (!user) return;

  await createNotification({
    userId: user._id,
    title: 'Shop invitation',
    body: `${shopkeeper.shopName || shopkeeper.fullName} added you as a customer. Review the invitation to verify details before accepting.`,
    type: 'info',
    customerId: customer._id,
    linkPath: `/portal/link-shops/${customer._id}`,
  });
};

/** Notify a customer about pending shop invitations (e.g. after first signup/login). */
export const notifyPendingInvitationsForUser = async (user) => {
  if (user.role !== 'customer' || !user.email) return;

  const pending = await Customer.find({
    email: user.email.toLowerCase(),
    linkStatus: 'pending',
    linkedUser: null,
  }).populate('shopkeeper', 'fullName shopName');

  await Promise.all(
    pending.map((customer) =>
      createNotification({
        userId: user._id,
        title: 'Shop invitation',
        body: `${customer.shopkeeper?.shopName || customer.shopkeeper?.fullName || 'A shop'} added you as a customer. Review the invitation to verify details before accepting.`,
        type: 'info',
        customerId: customer._id,
        linkPath: `/portal/link-shops/${customer._id}`,
      })
    )
  );
};
