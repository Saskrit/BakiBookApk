import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import PaymentSubmission from '../models/PaymentSubmission.js';
import Notification from '../models/Notification.js';
import {
  formatDate,
  formatRelativeDate,
  formatTime,
  formatPayment,
  formatNotification,
} from '../utils/formatters.js';
import { buildTransactionPaymentView } from '../utils/paymentStatus.js';
import { buildGroupedLedger } from '../utils/groupedLedger.js';

const findLinkedCustomers = async (user) => {
  return Customer.find({
    linkedUser: user._id,
    linkStatus: 'linked',
  }).populate('shopkeeper', 'shopName fullName phone shopLocation shopImage isShopVerified');
};

export const getPortalDashboard = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);

    if (!linked.length) {
      return res.json({
        success: true,
        summary: {
          currentDue: 0,
          totalPurchases: 0,
          totalPaid: 0,
          lastPayment: null,
          totalShops: 0,
          totalTransactions: 0,
        },
        shops: [],
      });
    }

    const customerIds = linked.map((c) => c._id);

    const [creditAgg, paymentAgg, lastPaymentDoc, txCounts, lastTxByCustomer, lastPayByCustomer] =
      await Promise.all([
        Transaction.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
        ]),
        Payment.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Payment.findOne({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
        Transaction.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: '$customer', count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$customer', lastAt: { $first: '$createdAt' } } },
        ]),
        Payment.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$customer', lastAt: { $first: '$createdAt' } } },
        ]),
      ]);

    const currentDue = linked.reduce((sum, c) => sum + c.balance, 0);
    const txCountMap = Object.fromEntries(
      txCounts.map((row) => [row._id.toString(), row.count])
    );
    const lastTxMap = Object.fromEntries(
      lastTxByCustomer.map((row) => [row._id.toString(), row.lastAt])
    );
    const lastPayMap = Object.fromEntries(
      lastPayByCustomer.map((row) => [row._id.toString(), row.lastAt])
    );

    const totalTransactions =
      (creditAgg[0]?.count || 0) + (paymentAgg[0]?.count || 0);

    res.json({
      success: true,
      summary: {
        currentDue,
        totalPurchases: creditAgg[0]?.total || 0,
        totalPaid: paymentAgg[0]?.total || 0,
        lastPayment: lastPaymentDoc ? formatDate(lastPaymentDoc.createdAt) : null,
        totalShops: linked.length,
        totalTransactions,
      },
      shops: linked.map((c) => {
        const key = c._id.toString();
        const lastCredit = lastTxMap[key] ? new Date(lastTxMap[key]).getTime() : 0;
        const lastPay = lastPayMap[key] ? new Date(lastPayMap[key]).getTime() : 0;
        const lastAt = Math.max(lastCredit, lastPay);
        let badge = 'regular';
        if (c.balance <= 0) badge = 'cleared';
        else if (c.creditScore === 'Excellent' || c.creditScore === 'Good') badge = 'preferred';
        else if (c.status === 'active') badge = 'active';

        return {
          id: key,
          shopName: c.shopkeeper?.shopName || 'Shop',
          shopkeeper: c.shopkeeper?.fullName || '',
          phone: c.shopkeeper?.phone || '',
          location: c.shopkeeper?.shopLocation || '',
          shopImage: c.shopkeeper?.shopImage || '',
          verified: !!c.shopkeeper?.isShopVerified,
          balance: c.balance,
          creditScore: c.creditScore || 'Average',
          transactionCount: txCountMap[key] || 0,
          lastTransactionAt: lastAt ? new Date(lastAt).toISOString() : null,
          lastTransaction: lastAt ? formatDate(new Date(lastAt)) : null,
          badge,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalLedger = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);
    const customerIds = linked.map((c) => c._id);
    const shopMap = Object.fromEntries(
      linked.map((c) => [c._id.toString(), c.shopkeeper?.shopName || 'Shop'])
    );

    const filter = req.query.filter === 'archived' ? 'archived' : 'active';

    const [transactions, payments] = await Promise.all([
      Transaction.find({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
      Payment.find({ customer: { $in: customerIds } })
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: -1 }),
    ]);

    const ledgerByCustomer = customerIds.map((customerId) => {
      const key = customerId.toString();
      const customerTx = transactions.filter((tx) => tx.customer.toString() === key);
      const customerPayments = payments.filter((p) => p.customer.toString() === key);
      return buildGroupedLedger({
        transactions: customerTx,
        payments: customerPayments,
        role: 'customer',
        filter,
        shopName: shopMap[key] || 'Shop',
      }).map((entry) => ({
        ...entry,
        customerId: key,
      }));
    });

    const ledger = ledgerByCustomer
      .flat()
      .sort((a, b) => new Date(b.sortAt || b.date) - new Date(a.sortAt || a.date));

    res.json({
      success: true,
      ledger,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalShopDetail = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      linkedUser: req.user._id,
      linkStatus: 'linked',
    }).populate('shopkeeper', 'shopName fullName phone shopLocation shopImage isShopVerified');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const customerId = customer._id;
    const shopName = customer.shopkeeper?.shopName || 'Shop';

    const [creditAgg, paymentAgg, lastPaymentDoc, transactions, payments] = await Promise.all([
      Transaction.aggregate([
        { $match: { customer: customerId } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { customer: customerId } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.findOne({ customer: customerId }).sort({ createdAt: -1 }),
      Transaction.find({ customer: customerId }).sort({ createdAt: -1 }).limit(200),
      Payment.find({ customer: customerId })
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: -1 })
        .limit(200),
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
        if (item?.name && recentPurchaseItems.length < 8) {
          recentPurchaseItems.push({
            name: item.name,
            qty: item.qty || 1,
            price: item.price || 0,
          });
        }
      }
      if (recentPurchaseItems.length >= 8) break;
    }

    const scoreLabel = customer.creditScore || 'Average';

    res.json({
      success: true,
      shop: {
        customerId: customerId.toString(),
        shopName,
        shopkeeper: customer.shopkeeper?.fullName || '',
        phone: customer.shopkeeper?.phone || '',
        location: customer.shopkeeper?.shopLocation || '',
        shopImage: customer.shopkeeper?.shopImage || '',
        verified: !!customer.shopkeeper?.isShopVerified,
        status: customer.status || 'active',
        creditScore: scoreLabel,
        balance: customer.balance || 0,
      },
      summary: {
        currentDue: customer.balance || 0,
        totalPurchases: creditAgg[0]?.total || 0,
        totalPaid: paymentAgg[0]?.total || 0,
        transactionCount: (creditAgg[0]?.count || 0) + (paymentAgg[0]?.count || 0),
        lastPaymentAmount: lastPaymentDoc?.amount || 0,
        lastPaymentDate: lastPaymentDoc ? formatDate(lastPaymentDoc.createdAt) : null,
      },
      ledger,
      recentPurchaseItems,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalTransactions = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);
    const customerIds = linked.map((c) => c._id);
    const shopMap = Object.fromEntries(
      linked.map((c) => [c._id.toString(), c.shopkeeper?.shopName || 'Shop'])
    );

    const [transactions, submissions, payments] = await Promise.all([
      Transaction.find({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
      PaymentSubmission.find({ customer: { $in: customerIds } }),
      Payment.find({ customer: { $in: customerIds } }).select(
        'payType transaction itemIndex customer createdAt'
      ),
    ]);

    const submissionsByCustomer = Object.fromEntries(
      customerIds.map((id) => [
        id.toString(),
        submissions.filter((s) => s.customer.toString() === id.toString()),
      ])
    );
    const paymentsByCustomer = Object.fromEntries(
      customerIds.map((id) => [
        id.toString(),
        payments.filter((p) => p.customer.toString() === id.toString()),
      ])
    );

    res.json({
      success: true,
      transactions: transactions.map((tx) => {
        const customerKey = tx.customer.toString();
        const paymentView = buildTransactionPaymentView(
          submissionsByCustomer[customerKey] || [],
          paymentsByCustomer[customerKey] || [],
          tx
        );

        return {
          id: tx._id.toString(),
          customerId: customerKey,
          shopName: shopMap[customerKey] || 'Shop',
          date: formatRelativeDate(tx.createdAt),
          rawDate: formatDate(tx.createdAt),
          items: paymentView.items,
          itemsSummary: tx.items.map((i) => i.name).join(', '),
          total: tx.total,
          totalFormatted: `Rs. ${tx.total.toLocaleString('en-NP')}`,
          paymentStatus: paymentView.paymentStatus,
          canPayTransaction: paymentView.canPayTransaction,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalPayments = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);
    const customerIds = linked.map((c) => c._id);
    const shopMap = Object.fromEntries(
      linked.map((c) => [c._id.toString(), c.shopkeeper?.shopName || 'Shop'])
    );

    const payments = await Payment.find({ customer: { $in: customerIds } })
      .populate('submission', 'itemName payLabel payType itemIndex transaction screenshotUrl')
      .sort({ createdAt: -1 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = monthStart;

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    let allTimeTotal = 0;

    const mapped = payments.map((p) => {
      const formatted = formatPayment(p, '', { submission: p.submission });
      const created = new Date(p.createdAt);
      allTimeTotal += p.amount;
      if (created >= monthStart) thisMonthTotal += p.amount;
      else if (created >= lastMonthStart && created < lastMonthEnd) lastMonthTotal += p.amount;

      const submissionId =
        p.submission?._id?.toString?.() ||
        (typeof p.submission === 'object' && p.submission?.id
          ? String(p.submission.id)
          : null) ||
        (p.submission ? String(p.submission) : null);

      return {
        id: formatted.id,
        customerId: p.customer?.toString?.() || p.customer,
        amount: p.amount,
        amountLabel: `NPR ${p.amount.toLocaleString('en-US')}`,
        method: p.method,
        shopName: shopMap[p.customer.toString()] || 'Shop',
        paidFor: formatted.paidFor,
        note: p.note || '',
        screenshotUrl: formatted.screenshotUrl || '',
        receiptNo: p.receiptNo || '',
        submissionId,
        status: 'verified',
        date: formatDate(p.createdAt),
        time: formatTime(p.createdAt),
        relativeDate: formatRelativeDate(p.createdAt),
        createdAt: p.createdAt,
      };
    });

    const monthChange =
      lastMonthTotal > 0
        ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
        : thisMonthTotal > 0
          ? 100
          : 0;

    res.json({
      success: true,
      summary: {
        totalPaid: allTimeTotal,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        monthChangePercent: monthChange,
        shopCount: linked.length,
      },
      payments: mapped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalDues = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);
    const currentDue = linked.reduce((sum, c) => sum + c.balance, 0);
    const customerIds = linked.map((c) => c._id);

    const pendingCustom = await PaymentSubmission.find({
      customer: { $in: customerIds },
      payType: 'custom',
      status: 'pending',
    }).select('customer');

    const pendingCustomSet = new Set(pendingCustom.map((s) => s.customer.toString()));

    res.json({
      success: true,
      currentDue,
      breakdown: linked
        .filter((c) => c.balance > 0)
        .map((c) => ({
          customerId: c._id.toString(),
          shopName: c.shopkeeper?.shopName || 'Shop',
          balance: c.balance,
          customPaymentStatus: pendingCustomSet.has(c._id.toString()) ? 'pending' : 'unpaid',
        })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPortalNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({
      success: true,
      notifications: notifications.map(formatNotification),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const CUSTOMER_BACKUP_SCHEMA = 1;

export const exportCustomerBackup = async (req, res) => {
  try {
    const linked = await findLinkedCustomers(req.user);
    const customerIds = linked.map((c) => c._id);
    const shopMap = Object.fromEntries(
      linked.map((c) => [c._id.toString(), c.shopkeeper?.shopName || 'Shop'])
    );

    const [transactions, payments, submissions] = await Promise.all([
      Transaction.find({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
      Payment.find({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
      PaymentSubmission.find({ customer: { $in: customerIds } }).sort({ createdAt: -1 }),
    ]);

    const ledgerByCustomer = customerIds.map((customerId) => {
      const key = customerId.toString();
      const customerTx = transactions.filter((tx) => tx.customer.toString() === key);
      const customerPayments = payments.filter((p) => p.customer.toString() === key);
      return buildGroupedLedger({
        transactions: customerTx,
        payments: customerPayments,
        role: 'customer',
        filter: 'active',
        shopName: shopMap[key] || 'Shop',
      }).map((entry) => ({
        ...entry,
        customerId: key,
      }));
    });

    const ledger = ledgerByCustomer
      .flat()
      .sort((a, b) => new Date(b.sortAt || b.date) - new Date(a.sortAt || a.date));

    const currentDue = linked.reduce((sum, c) => sum + c.balance, 0);
    const totalPurchases = transactions.reduce((sum, tx) => sum + (tx.total || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const backup = {
      schemaVersion: CUSTOMER_BACKUP_SCHEMA,
      backupType: 'customer',
      exportedAt: new Date().toISOString(),
      userId: req.user._id.toString(),
      profile: {
        fullName: req.user.fullName || '',
        email: req.user.email || '',
        phone: req.user.phone || '',
      },
      summary: {
        currentDue,
        totalPurchases,
        totalPaid,
        totalShops: linked.length,
        ledgerCount: ledger.length,
      },
      shops: linked.map((c) => ({
        customerId: c._id.toString(),
        shopName: c.shopkeeper?.shopName || 'Shop',
        balance: c.balance,
        creditScore: c.creditScore,
        linkStatus: c.linkStatus,
      })),
      ledger,
      paymentSubmissions: submissions.map((s) => ({
        id: s._id.toString(),
        customerId: s.customer?.toString(),
        amount: s.amount,
        method: s.method,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };

    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
