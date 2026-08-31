import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import { formatTransaction, formatPayment } from '../utils/formatters.js';
import { parsePagination, paginateArray } from '../utils/pagination.js';
import { getShopkeeperId } from '../utils/shopContext.js';

const AGING_COLORS = ['#6A7E3F', '#D4A843', '#C08552', '#C45C5C'];

const buildDailySeries = async (shopkeeperId, days = 30) => {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [creditByDay, paymentByDay] = await Promise.all([
    Transaction.aggregate([
      { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const creditMap = Object.fromEntries(creditByDay.map((d) => [d._id, d.total]));
  const paymentMap = Object.fromEntries(paymentByDay.map((d) => [d._id, d.total]));

  const credit = [];
  const payment = [];

  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = day.toISOString().split('T')[0];
    credit.push(creditMap[key] || 0);
    payment.push(paymentMap[key] || 0);
  }

  return { credit, payment };
};

const computeAgingData = (customers) => {
  const buckets = [
    { label: '0-30 Days', min: 0, max: 30, value: 0, color: AGING_COLORS[0] },
    { label: '31-60 Days', min: 31, max: 60, value: 0, color: AGING_COLORS[1] },
    { label: '61-90 Days', min: 61, max: 90, value: 0, color: AGING_COLORS[2] },
    { label: '90+ Days', min: 91, max: Infinity, value: 0, color: AGING_COLORS[3] },
  ];

  for (const customer of customers) {
    if (customer.balance <= 0) continue;

    const refDate = customer.lastCreditDate || customer.createdAt;
    const days = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
    const bucket =
      buckets.find((b) => days >= b.min && days <= b.max) || buckets[buckets.length - 1];
    bucket.value += customer.balance;
  }

  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
    percent: total ? Math.round((bucket.value / total) * 100) : 0,
    color: bucket.color,
  }));
};

const buildDueReminders = (customers, limit = 5) =>
  customers
    .filter((c) => c.balance > 0)
    .map((c) => {
      const refDate = c.lastCreditDate || c.createdAt;
      const daysOverdue = Math.floor(
        (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        customerId: c._id.toString(),
        name: c.name,
        amount: c.balance,
        daysOverdue,
        daysLabel:
          daysOverdue === 0
            ? 'Today'
            : daysOverdue === 1
              ? '1 day ago'
              : `${daysOverdue} days ago`,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, limit);

const buildPeriodMeta = (start, end) => ({
  periodStart: start.toISOString(),
  periodEnd: end.toISOString(),
});

const fetchCreditsReport = async (shopkeeperId, start, end) => {
  const txs = await Transaction.find({
    shopkeeper: shopkeeperId,
    createdAt: { $gte: start, $lte: end },
  })
    .populate('customer', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const credits = txs.map((tx) => {
    const formatted = formatTransaction(tx, tx.customer?.name);
    return {
      date: formatted.date,
      time: formatted.time,
      customer: formatted.customerName,
      products: formatted.products,
      total: formatted.total,
      note: formatted.note || '',
    };
  });

  return {
    credits,
    creditGiven: txs.reduce((sum, tx) => sum + tx.total, 0),
    transactionCount: txs.length,
  };
};

const fetchPaymentsReport = async (shopkeeperId, start, end) => {
  const payments = await Payment.find({
    shopkeeper: shopkeeperId,
    createdAt: { $gte: start, $lte: end },
  })
    .populate('customer', 'name')
    .populate('submission', 'itemName payLabel payType')
    .sort({ createdAt: -1 })
    .lean();

  const rows = payments.map((p) => {
    const formatted = formatPayment(p, p.customer?.name, { submission: p.submission });
    return {
      date: formatted.date,
      time: formatted.time,
      customer: formatted.customerName,
      paidFor: formatted.paidFor || 'General payment',
      amount: formatted.amount,
      method: formatted.method,
      receipt: formatted.receiptNo,
      note: formatted.note || '',
    };
  });

  return {
    payments: rows,
    paymentsReceived: payments.reduce((sum, p) => sum + p.amount, 0),
    paymentCount: payments.length,
  };
};

const fetchProductsReport = async (shopkeeperId, start, end) => {
  const txs = await Transaction.find({
    shopkeeper: shopkeeperId,
    createdAt: { $gte: start, $lte: end },
  })
    .populate('customer', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const products = [];
  for (const tx of txs) {
    const customerName = tx.customer?.name || '';
    const date = formatTransaction(tx, customerName).date;
    for (const item of tx.items || []) {
      products.push({
        date,
        customer: customerName,
        product: item.name,
        qty: item.qty,
        unit: item.unit === 'kg' || item.unit === 'ltr' ? item.unit : 'none',
        unitPrice: item.price,
        lineTotal: (item.qty || 0) * (item.price || 0),
      });
    }
  }

  return {
    products,
    productCount: products.length,
    productValue: products.reduce((sum, row) => sum + row.lineTotal, 0),
  };
};

const fetchActivityReport = async (shopkeeperId, start, end) => {
  const [creditData, paymentData] = await Promise.all([
    fetchCreditsReport(shopkeeperId, start, end),
    fetchPaymentsReport(shopkeeperId, start, end),
  ]);

  const activity = [
    ...creditData.credits.map((row) => ({
      date: `${row.date} ${row.time}`,
      type: 'Credit',
      customer: row.customer,
      detail: row.products,
      amount: row.total,
      reference: row.note || '—',
    })),
    ...paymentData.payments.map((row) => ({
      date: `${row.date} ${row.time}`,
      type: 'Payment',
      customer: row.customer,
      detail: row.paidFor,
      amount: row.amount,
      reference: row.receipt,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    activity,
    creditGiven: creditData.creditGiven,
    paymentsReceived: paymentData.paymentsReceived,
    transactionCount: creditData.transactionCount,
    paymentCount: paymentData.paymentCount,
  };
};

const getDateRange = (period, from, to) => {
  const now = new Date();

  if (from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date();

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'weekly') {
    start.setDate(now.getDate() - 7);
  } else if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setFullYear(2000);
  }

  return { start, end: now };
};

export const getDashboardStats = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      totalCustomers,
      dueCustomers,
      outstandingAgg,
      creditAgg,
      paymentAgg,
      todayTxCount,
      weekCreditAgg,
      weekPaymentAgg,
      topDue,
      recentTx,
      recentPayments,
      allCustomers,
      chartSeries,
    ] = await Promise.all([
      Customer.countDocuments({ shopkeeper: shopkeeperId }),
      Customer.countDocuments({ shopkeeper: shopkeeperId, balance: { $gt: 0 } }),
      Customer.aggregate([
        { $match: { shopkeeper: shopkeeperId } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Transaction.aggregate([
        { $match: { shopkeeper: shopkeeperId } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Payment.aggregate([
        { $match: { shopkeeper: shopkeeperId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ shopkeeper: shopkeeperId, createdAt: { $gte: startOfToday } }),
      Transaction.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Payment.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } })
        .sort({ balance: -1 })
        .limit(5)
        .select('name balance'),
      Transaction.find({ shopkeeper: shopkeeperId })
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      Payment.find({ shopkeeper: shopkeeperId })
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      Customer.find({ shopkeeper: shopkeeperId }).select(
        'name balance lastCreditDate createdAt'
      ),
      buildDailySeries(shopkeeperId),
    ]);

    const outstanding = outstandingAgg[0]?.total || 0;
    const totalCredit = creditAgg[0]?.total || 0;
    const totalPayments = paymentAgg[0]?.total || 0;

    const recentActivity = [
      ...recentTx.map((tx) => ({
        id: tx._id.toString(),
        type: 'credit',
        text: `Credit added to ${tx.customer?.name || 'customer'}`,
        amount: tx.total,
        time: tx.createdAt,
      })),
      ...recentPayments.map((p) => ({
        id: p._id.toString(),
        type: 'payment',
        text: `Payment received from ${p.customer?.name || 'customer'}`,
        amount: p.amount,
        time: p.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 5);

    const agingData = computeAgingData(allCustomers);
    const dueReminders = buildDueReminders(allCustomers);

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalOutstanding: outstanding,
        totalCredit,
        totalPayments,
        todayTransactions: todayTxCount,
        weekCredit: weekCreditAgg[0]?.total || 0,
        weekPayment: weekPaymentAgg[0]?.total || 0,
        customersWithDues: dueCustomers,
      },
      chart: chartSeries,
      agingData,
      dueReminders,
      topDueCustomers: topDue.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        amount: c.balance,
        avatar: c.name
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
      })),
      recentTransactions: recentActivity,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReport = async (req, res) => {
  try {
    const { period = 'daily', from, to, type = 'summary' } = req.query;
    const shopkeeperId = getShopkeeperId(req);
    const { start, end } = getDateRange(period, from, to);

    if (type === 'outstanding') {
      const customers = await Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } })
        .sort({ balance: -1 })
        .select('name balance creditScore phone');

      const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period: 'outstanding',
        type: 'outstanding',
        report: {
          totalOutstanding,
          customerCount: customers.length,
          periodStart: null,
          periodEnd: new Date().toISOString(),
        },
        customers: customers.map((c) => ({
          name: c.name,
          balance: c.balance,
          creditScore: c.creditScore || 'Average',
          phone: c.phone || '',
        })),
      });
    }

    if (type === 'credits') {
      const creditData = await fetchCreditsReport(shopkeeperId, start, end);
      const dueCustomers = await Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } });
      const totalOutstanding = dueCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'credits',
        report: {
          ...buildPeriodMeta(start, end),
          creditGiven: creditData.creditGiven,
          transactionCount: creditData.transactionCount,
          totalOutstanding,
        },
        credits: creditData.credits,
      });
    }

    if (type === 'payments') {
      const paymentData = await fetchPaymentsReport(shopkeeperId, start, end);
      const dueCustomers = await Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } });
      const totalOutstanding = dueCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'payments',
        report: {
          ...buildPeriodMeta(start, end),
          paymentsReceived: paymentData.paymentsReceived,
          paymentCount: paymentData.paymentCount,
          totalOutstanding,
        },
        payments: paymentData.payments,
      });
    }

    if (type === 'products') {
      const productData = await fetchProductsReport(shopkeeperId, start, end);

      return res.json({
        success: true,
        period,
        type: 'products',
        report: {
          ...buildPeriodMeta(start, end),
          productCount: productData.productCount,
          productValue: productData.productValue,
        },
        products: productData.products,
      });
    }

    if (type === 'activity') {
      const activityData = await fetchActivityReport(shopkeeperId, start, end);
      const dueCustomers = await Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } });
      const totalOutstanding = dueCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'activity',
        report: {
          ...buildPeriodMeta(start, end),
          creditGiven: activityData.creditGiven,
          paymentsReceived: activityData.paymentsReceived,
          transactionCount: activityData.transactionCount,
          paymentCount: activityData.paymentCount,
          totalOutstanding,
        },
        activity: activityData.activity,
      });
    }

    if (type === 'customers') {
      const allCustomers = await Customer.find({ shopkeeper: shopkeeperId })
        .sort({ name: 1 })
        .select('name phone email balance creditScore status');

      const totalOutstanding = allCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'customers',
        report: {
          ...buildPeriodMeta(start, end),
          customerCount: allCustomers.length,
          customersWithDues: allCustomers.filter((c) => c.balance > 0).length,
          totalOutstanding,
        },
        customers: allCustomers.map((c) => ({
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          balance: c.balance,
          creditScore: c.creditScore || 'Average',
          status: c.status,
        })),
      });
    }

    if (type === 'complete') {
      const [
        creditData,
        paymentData,
        productData,
        activityData,
        dueCustomers,
        allCustomers,
      ] = await Promise.all([
        fetchCreditsReport(shopkeeperId, start, end),
        fetchPaymentsReport(shopkeeperId, start, end),
        fetchProductsReport(shopkeeperId, start, end),
        fetchActivityReport(shopkeeperId, start, end),
        Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } })
          .sort({ balance: -1 })
          .select('name balance creditScore phone'),
        Customer.find({ shopkeeper: shopkeeperId })
          .sort({ name: 1 })
          .select('name phone balance creditScore status'),
      ]);

      const totalOutstanding = dueCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'complete',
        report: {
          ...buildPeriodMeta(start, end),
          creditGiven: creditData.creditGiven,
          paymentsReceived: paymentData.paymentsReceived,
          transactionCount: creditData.transactionCount,
          paymentCount: paymentData.paymentCount,
          productCount: productData.productCount,
          customerCount: allCustomers.length,
          customersWithDues: dueCustomers.length,
          totalOutstanding,
        },
        credits: creditData.credits,
        payments: paymentData.payments,
        products: productData.products,
        activity: activityData.activity,
        customers: allCustomers.map((c) => ({
          name: c.name,
          phone: c.phone || '',
          balance: c.balance,
          creditScore: c.creditScore || 'Average',
          status: c.status,
        })),
        outstanding: dueCustomers.map((c) => ({
          name: c.name,
          balance: c.balance,
          creditScore: c.creditScore || 'Average',
          phone: c.phone || '',
        })),
      });
    }

    if (type === 'customer') {
      const [creditByCustomer, paymentByCustomer, allCustomers] = await Promise.all([
        Transaction.aggregate([
          { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: '$customer',
              credit: { $sum: '$total' },
              txCount: { $sum: 1 },
            },
          },
        ]),
        Payment.aggregate([
          { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: '$customer', payments: { $sum: '$amount' } } },
        ]),
        Customer.find({ shopkeeper: shopkeeperId }).select('name balance'),
      ]);

      const creditMap = Object.fromEntries(
        creditByCustomer.map((row) => [row._id.toString(), row])
      );
      const paymentMap = Object.fromEntries(
        paymentByCustomer.map((row) => [row._id.toString(), row.payments])
      );

      const customers = allCustomers
        .map((c) => {
          const id = c._id.toString();
          const creditRow = creditMap[id];
          return {
            name: c.name,
            credit: creditRow?.credit || 0,
            payments: paymentMap[id] || 0,
            txCount: creditRow?.txCount || 0,
            balance: c.balance,
          };
        })
        .filter((c) => c.credit > 0 || c.payments > 0 || c.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      const creditGiven = customers.reduce((sum, c) => sum + c.credit, 0);
      const paymentsReceived = customers.reduce((sum, c) => sum + c.payments, 0);
      const transactionCount = customers.reduce((sum, c) => sum + c.txCount, 0);
      const totalOutstanding = allCustomers.reduce((sum, c) => sum + c.balance, 0);

      return res.json({
        success: true,
        period,
        type: 'customer',
        report: {
          creditGiven,
          paymentsReceived,
          transactionCount,
          totalOutstanding,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        },
        customers,
      });
    }

    const [creditAgg, paymentAgg, txCount, customers] = await Promise.all([
      Transaction.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Payment.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ shopkeeper: shopkeeperId, createdAt: { $gte: start, $lte: end } }),
      Customer.find({ shopkeeper: shopkeeperId, balance: { $gt: 0 } }),
    ]);

    const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

    res.json({
      success: true,
      period,
      type: 'summary',
      report: {
        creditGiven: creditAgg[0]?.total || 0,
        paymentsReceived: paymentAgg[0]?.total || 0,
        transactionCount: txCount,
        totalOutstanding,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const months = 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    const [creditByMonth, paymentByMonth, topCustomers] = await Promise.all([
      Transaction.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Customer.find({ shopkeeper: shopkeeperId })
        .sort({ balance: -1 })
        .limit(10)
        .select('name balance creditScore'),
    ]);

    res.json({
      success: true,
      analytics: {
        creditByMonth,
        paymentByMonth,
        topCustomers: topCustomers.map((c) => ({
          name: c.name,
          balance: c.balance,
          creditScore: c.creditScore,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopActivity = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const { page, limit } = parsePagination(req.query);

    const [transactions, payments] = await Promise.all([
      Transaction.find({ shopkeeper: shopkeeperId })
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Payment.find({ shopkeeper: shopkeeperId })
        .populate('customer', 'name')
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const merged = [
      ...transactions.map((tx) => {
        const formatted = formatTransaction(tx, tx.customer?.name);
        return {
          id: `credit-${formatted.id}`,
          kind: 'credit',
          date: formatted.date,
          time: formatted.time,
          customerName: formatted.customerName,
          productFor: formatted.products || '—',
          amount: formatted.total,
          method: '—',
          reference: formatted.note || '—',
          viewTo: `/shop/transactions/${formatted.id}`,
          editTo: `/shop/transactions/${formatted.id}/edit`,
          sortAt: tx.createdAt,
        };
      }),
      ...payments.map((p) => {
        const formatted = formatPayment(p, p.customer?.name, { submission: p.submission });
        return {
          id: `payment-${formatted.id}`,
          kind: 'payment',
          date: formatted.date,
          time: formatted.time,
          customerName: formatted.customerName,
          productFor: formatted.paidFor || 'General payment',
          amount: formatted.amount,
          method: formatted.method,
          reference: formatted.receiptNo,
          viewTo: `/shop/payments/${formatted.id}`,
          editTo: null,
          sortAt: p.createdAt,
        };
      }),
    ].sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));

    const { items, pagination } = paginateArray(merged, page, limit);

    res.json({
      success: true,
      activity: items.map(({ sortAt, ...row }) => row),
      pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
