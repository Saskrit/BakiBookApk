import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import { getShopkeeperId } from '../utils/shopContext.js';

const getPaymentForCustomer = async (paymentId, userId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) return null;

  const customer = await Customer.findOne({
    _id: payment.customer,
    linkedUser: userId,
    linkStatus: 'linked',
  });

  if (!customer) return null;
  return payment;
};

const getPaymentForShopkeeper = async (paymentId, shopkeeperId) => {
  return Payment.findOne({
    _id: paymentId,
    shopkeeper: shopkeeperId,
  });
};

const ensureProductLinked = (payment, res) => {
  if (payment.payType !== 'transaction' && payment.payType !== 'item') {
    res.status(400).json({
      success: false,
      message: 'Only product-linked paid entries can be archived or hidden.',
    });
    return false;
  }
  return true;
};

export const archivePaidEntryForCustomer = async (req, res) => {
  try {
    const payment = await getPaymentForCustomer(req.params.paymentId, req.user._id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paid entry not found' });
    }
    if (!ensureProductLinked(payment, res)) return;

    payment.customerArchived = true;
    await payment.save();

    res.json({ success: true, message: 'Entry archived for your account' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unarchivePaidEntryForCustomer = async (req, res) => {
  try {
    const payment = await getPaymentForCustomer(req.params.paymentId, req.user._id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paid entry not found' });
    }
    if (!ensureProductLinked(payment, res)) return;

    payment.customerArchived = false;
    await payment.save();

    res.json({ success: true, message: 'Entry restored to your ledger' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const hidePaidEntryForShopkeeper = async (req, res) => {
  try {
    const payment = await getPaymentForShopkeeper(req.params.paymentId, getShopkeeperId(req));
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paid entry not found' });
    }
    if (!ensureProductLinked(payment, res)) return;

    payment.shopkeeperHidden = true;
    await payment.save();

    res.json({ success: true, message: 'Entry removed from your ledger view' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restorePaidEntryForShopkeeper = async (req, res) => {
  try {
    const payment = await getPaymentForShopkeeper(req.params.paymentId, getShopkeeperId(req));
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paid entry not found' });
    }
    if (!ensureProductLinked(payment, res)) return;

    payment.shopkeeperHidden = false;
    await payment.save();

    res.json({ success: true, message: 'Entry restored to your ledger view' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
