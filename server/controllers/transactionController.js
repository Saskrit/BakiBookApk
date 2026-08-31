import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import { applyCredit, recalculateBalance } from '../utils/customerBalance.js';
import { formatTransaction } from '../utils/formatters.js';
import { createNotification } from '../utils/notify.js';
import { upsertProductsFromItems } from '../utils/productCatalog.js';
import { getShopkeeperId } from '../utils/shopContext.js';
import { emitDataInvalidate, emitShopDataSync } from '../utils/realtimeSync.js';

const getCustomerName = async (customerId) => {
  const c = await Customer.findById(customerId).select('name');
  return c?.name || '';
};

export const listTransactions = async (req, res) => {
  try {
    const filter = { shopkeeper: getShopkeeperId(req) };
    if (req.query.customerId) filter.customer = req.query.customerId;

    const transactions = await Transaction.find(filter)
      .populate('customer', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions: transactions.map((tx) =>
        formatTransaction(tx, tx.customer?.name)
      ),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const tx = await Transaction.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    }).populate('customer', 'name');

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, transaction: formatTransaction(tx, tx.customer?.name) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const { customerId, items, note } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer is required' });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const parsedItems = Array.isArray(items) ? items : [items].filter(Boolean);
    if (!parsedItems.length) {
      return res.status(400).json({ success: false, message: 'At least one item is required' });
    }

    const normalizedItems = parsedItems.map((item) => {
      const rawUnit = String(item.unit || 'none').toLowerCase();
      const unit = rawUnit === 'kg' || rawUnit === 'ltr' ? rawUnit : 'none';
      return {
        name: String(item.name || '').trim(),
        qty: Number(item.qty) || 1,
        price: Number(item.price) || 0,
        unit,
      };
    });

    const total = normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    if (total <= 0) {
      return res.status(400).json({ success: false, message: 'Total must be greater than zero' });
    }

    const tx = await Transaction.create({
      shopkeeper: getShopkeeperId(req),
      customer: customerId,
      items: normalizedItems,
      total,
      note: note?.trim() || '',
    });

    await applyCredit(customerId, total);
    await upsertProductsFromItems(getShopkeeperId(req), normalizedItems);

    await createNotification({
      userId: getShopkeeperId(req),
      title: 'Credit added',
      body: `${customer.name} — Rs. ${total.toLocaleString('en-NP')} credit recorded.`,
      type: 'info',
      customerId,
      linkPath: `/shop/transactions/${tx._id}`,
    });

    if (customer.linkedUser && customer.linkStatus === 'linked') {
      await createNotification({
        userId: customer.linkedUser,
        title: 'New credit added',
        body: `Rs. ${total.toLocaleString('en-NP')} added to your account at ${req.user.shopName || 'your shop'}.`,
        type: 'info',
        customerId,
      });
      emitDataInvalidate(customer.linkedUser, ['ledger', 'payments', 'all']);
    }

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'ledger', 'all'],
      excludeUserId: req.user._id,
    });

    res.status(201).json({
      success: true,
      transaction: formatTransaction(tx, customer.name),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const { items, note, total } = req.body;
    if (note !== undefined) tx.note = note?.trim() || '';

    if (items?.length) {
      tx.items = items.map((item) => {
        const rawUnit = String(item.unit || 'none').toLowerCase();
        const unit = rawUnit === 'kg' || rawUnit === 'ltr' ? rawUnit : 'none';
        return {
          name: String(item.name || '').trim(),
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          unit,
        };
      });
      tx.total = tx.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    } else if (total !== undefined) {
      tx.total = Number(total);
    }

    await tx.save();
    await recalculateBalance(tx.customer);
    if (tx.items?.length) {
      await upsertProductsFromItems(getShopkeeperId(req), tx.items);
    }

    const customerName = await getCustomerName(tx.customer);

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'ledger', 'all'],
      excludeUserId: req.user._id,
    });

    res.json({ success: true, transaction: formatTransaction(tx, customerName) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    await recalculateBalance(tx.customer);

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'ledger', 'all'],
      excludeUserId: req.user._id,
    });

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
