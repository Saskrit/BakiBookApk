import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import { formatCustomer, formatTransaction, formatPayment } from '../utils/formatters.js';
import { buildGroupedLedger } from '../utils/groupedLedger.js';

const getCustomerAccess = async (user, customerId) => {
  const customer = await Customer.findById(customerId)
    .populate('shopkeeper', 'fullName shopName shopLocation shopImage email')
    .populate({ path: 'linkedUser', select: 'profileImage' });
  if (!customer) return null;

  if (user.role === 'shopkeeper' && customer.shopkeeper._id.toString() === user._id.toString()) {
    return customer;
  }

  if (
    user.role === 'customer' &&
    customer.linkStatus === 'linked' &&
    customer.linkedUser?.toString() === user._id.toString()
  ) {
    return customer;
  }

  return null;
};

export const getSharedCredits = async (req, res) => {
  try {
    const customer = await getCustomerAccess(req.user, req.params.customerId);
    if (!customer) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [transactions, payments] = await Promise.all([
      Transaction.find({ customer: customer._id }).sort({ createdAt: -1 }),
      Payment.find({ customer: customer._id })
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: -1 }),
    ]);

    const filter = req.query.filter === 'archived' ? 'archived' : 'active';
    const role = req.user.role === 'customer' ? 'customer' : 'shopkeeper';
    const ledger = buildGroupedLedger({
      transactions,
      payments,
      role,
      filter,
      includeRunningBalance: true,
    });

    const totalCredit = transactions.reduce((s, t) => s + t.total, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      success: true,
      customer: formatCustomer(customer),
      shop: {
        name: customer.shopkeeper.shopName,
        owner: customer.shopkeeper.fullName,
        location: customer.shopkeeper.shopLocation,
      },
      summary: {
        balance: customer.balance,
        totalCredit,
        totalPaid,
        transactionCount: transactions.length,
        paymentCount: payments.length,
      },
      ledger,
      transactions: transactions.map((tx) => formatTransaction(tx, customer.name)),
      payments: payments.map((p) => formatPayment(p, customer.name)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
