import Customer from '../models/Customer.js';

export const computeCreditScore = (customer) => {
  if (customer.balance <= 0) return 'Excellent';

  const refDate = customer.lastCreditDate || customer.createdAt;
  const days = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));

  if (days >= 90) return 'Defaulter';
  if (days >= 60) return 'Risky';
  if (days >= 30) return 'Average';
  return 'Good';
};

export const applyCredit = async (customerId, amount) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  customer.balance += amount;
  customer.lastCreditDate = new Date();
  customer.creditScore = computeCreditScore(customer);
  await customer.save();
  return customer;
};

export const applyPayment = async (customerId, amount, session = null) => {
  const query = Customer.findById(customerId);
  if (session) query.session(session);
  const customer = await query;
  if (!customer) throw new Error('Customer not found');

  customer.balance = Math.max(0, customer.balance - amount);
  customer.lastPaymentDate = new Date();
  customer.creditScore = computeCreditScore(customer);
  await customer.save(session ? { session } : undefined);
  return customer;
};

export const recalculateBalance = async (customerId) => {
  const Transaction = (await import('../models/Transaction.js')).default;
  const Payment = (await import('../models/Payment.js')).default;

  const [creditTotal, paymentTotal] = await Promise.all([
    Transaction.aggregate([
      { $match: { customer: customerId } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Payment.aggregate([
      { $match: { customer: customerId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const credits = creditTotal[0]?.total || 0;
  const payments = paymentTotal[0]?.total || 0;

  const customer = await Customer.findById(customerId);
  customer.balance = Math.max(0, credits - payments);
  customer.creditScore = computeCreditScore(customer);
  await customer.save();
  return customer;
};

export const generateReceiptNo = async (shopkeeperId) => {
  const Payment = (await import('../models/Payment.js')).default;
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({ shopkeeper: shopkeeperId });
  return `RCP-${year}-${String(count + 1).padStart(4, '0')}`;
};
