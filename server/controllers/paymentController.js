import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import { applyPayment, generateReceiptNo } from '../utils/customerBalance.js';
import { formatPayment } from '../utils/formatters.js';
import { createNotification } from '../utils/notify.js';

import { getShopkeeperId } from '../utils/shopContext.js';
import { emitDataInvalidate, emitShopDataSync } from '../utils/realtimeSync.js';

export const listPayments = async (req, res) => {
  try {
    const filter = { shopkeeper: getShopkeeperId(req) };
    if (req.query.customerId) filter.customer = req.query.customerId;

    const payments = await Payment.find(filter)
      .populate('customer', 'name')
      .populate('submission', 'itemName payLabel payType itemIndex transaction')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments: payments.map((p) => formatPayment(p, p.customer?.name, { submission: p.submission })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    })
      .populate('customer', 'name')
      .populate('submission', 'itemName payLabel payType itemIndex transaction');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({
      success: true,
      payment: formatPayment(payment, payment.customer?.name, { submission: payment.submission }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPayment = async (req, res) => {
  try {
    const { customerId, amount, method, note } = req.body;

    if (!customerId || !amount) {
      return res.status(400).json({ success: false, message: 'Customer and amount are required' });
    }

    const parsedAmount = Number(amount);
    if (parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const receiptNo = await generateReceiptNo(getShopkeeperId(req));

    const payment = await Payment.create({
      shopkeeper: getShopkeeperId(req),
      customer: customerId,
      amount: parsedAmount,
      method: method || 'Cash',
      note: note?.trim() || '',
      receiptNo,
    });

    await applyPayment(customerId, parsedAmount);

    await createNotification({
      userId: getShopkeeperId(req),
      title: 'Payment received',
      body: `${customer.name} paid Rs. ${parsedAmount.toLocaleString('en-NP')}.`,
      type: 'success',
      customerId,
      linkPath: `/shop/ledger/${customerId}`,
    });

    if (customer.linkedUser && customer.linkStatus === 'linked') {
      await createNotification({
        userId: customer.linkedUser,
        title: 'Payment recorded',
        body: `Rs. ${parsedAmount.toLocaleString('en-NP')} payment confirmed.`,
        type: 'success',
        customerId,
      });
      emitDataInvalidate(customer.linkedUser, ['ledger', 'payments', 'all']);
    }

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'ledger', 'payments', 'all'],
      excludeUserId: req.user._id,
    });

    res.status(201).json({
      success: true,
      payment: formatPayment(payment, customer.name),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const { recalculateBalance } = await import('../utils/customerBalance.js');
    await recalculateBalance(payment.customer);

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'ledger', 'payments', 'all'],
      excludeUserId: req.user._id,
    });

    res.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
