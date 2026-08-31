import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import Product from '../models/Product.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import { applyCredit, applyPayment, generateReceiptNo, recalculateBalance } from '../utils/customerBalance.js';
import { getShopkeeperId } from '../utils/shopContext.js';
import { emitShopDataSync } from '../utils/realtimeSync.js';

const BACKUP_SCHEMA_VERSION = 1;

function formatBackupCustomer(customer) {
  const id = customer._id.toString();
  return {
    legacyId: id,
    backupId: `cust-${id}`,
    name: customer.name,
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    status: customer.status,
    creditScore: customer.creditScore,
    balance: customer.balance,
    notes: customer.notes || '',
    qrCode: customer.qrCode || '',
    linkStatus: customer.linkStatus,
    lastCreditDate: customer.lastCreditDate,
    lastPaymentDate: customer.lastPaymentDate,
    createdAt: customer.createdAt,
  };
}

function validateBackupPayload(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup payload');
  }
  if (Number(backup.schemaVersion) !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version (expected ${BACKUP_SCHEMA_VERSION})`);
  }
  if (!Array.isArray(backup.customers)) {
    throw new Error('Backup is missing customers');
  }
}

async function findExistingCustomer(shopkeeperId, row) {
  if (row.phone?.trim()) {
    const byPhone = await Customer.findOne({
      shopkeeper: shopkeeperId,
      phone: row.phone.trim(),
    });
    if (byPhone) return byPhone;
  }
  if (row.qrCode?.trim()) {
    const byQr = await Customer.findOne({
      shopkeeper: shopkeeperId,
      qrCode: row.qrCode.trim(),
    });
    if (byQr) return byQr;
  }
  return null;
}

export const exportShopBackup = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);

    const [owner, customers, transactions, payments, products, expenses] = await Promise.all([
      User.findById(shopkeeperId).select('shopName shopLocation shopImage email name'),
      Customer.find({ shopkeeper: shopkeeperId }).sort({ name: 1 }),
      Transaction.find({ shopkeeper: shopkeeperId }).sort({ createdAt: 1 }),
      Payment.find({ shopkeeper: shopkeeperId }).sort({ createdAt: 1 }),
      Product.find({ shopkeeper: shopkeeperId }).sort({ name: 1 }),
      Expense.find({ shopkeeper: shopkeeperId }).sort({ expenseDate: -1 }),
    ]);

    const totalOutstanding = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

    const backup = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      shopOwnerId: shopkeeperId.toString(),
      shop: {
        shopName: owner?.shopName || '',
        shopLocation: owner?.shopLocation || '',
        shopImage: owner?.shopImage || '',
        ownerName: owner?.name || '',
        ownerEmail: owner?.email || '',
      },
      customers: customers.map(formatBackupCustomer),
      transactions: transactions.map((tx) => ({
        legacyId: tx._id.toString(),
        legacyCustomerId: tx.customer.toString(),
        items: tx.items,
        total: tx.total,
        note: tx.note || '',
        createdAt: tx.createdAt,
      })),
      payments: payments.map((p) => ({
        legacyId: p._id.toString(),
        legacyCustomerId: p.customer.toString(),
        amount: p.amount,
        method: p.method,
        note: p.note || '',
        receiptNo: p.receiptNo,
        payType: p.payType,
        createdAt: p.createdAt,
      })),
      products: products.map((p) => ({
        legacyId: p._id.toString(),
        name: p.name,
        lastPrice: p.lastPrice,
        usageCount: p.usageCount,
        lastUsedAt: p.lastUsedAt,
      })),
      expenses: expenses.map((e) => ({
        legacyId: e._id.toString(),
        title: e.title,
        amount: e.amount,
        category: e.category,
        note: e.note || '',
        expenseDate: e.expenseDate,
        createdAt: e.createdAt,
      })),
      summary: {
        customerCount: customers.length,
        transactionCount: transactions.length,
        paymentCount: payments.length,
        productCount: products.length,
        expenseCount: expenses.length,
        totalOutstanding,
        shopName: owner?.shopName || '',
      },
    };

    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreShopBackup = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const { backup, mode = 'merge' } = req.body;

    validateBackupPayload(backup);

    if (mode !== 'merge') {
      return res.status(400).json({
        success: false,
        message: 'Only merge restore is supported',
      });
    }

    const stats = {
      customersAdded: 0,
      customersSkipped: 0,
      transactionsAdded: 0,
      transactionsSkipped: 0,
      paymentsAdded: 0,
      paymentsSkipped: 0,
      productsAdded: 0,
      productsUpdated: 0,
      expensesAdded: 0,
      expensesSkipped: 0,
    };

    const customerIdMap = new Map();

    for (const row of backup.customers) {
      const legacyId = row.legacyId || row.backupId?.replace(/^cust-/, '');
      if (!legacyId) continue;

      const existing = await findExistingCustomer(shopkeeperId, row);
      if (existing) {
        customerIdMap.set(legacyId, existing._id);
        stats.customersSkipped += 1;
        continue;
      }

      const payload = {
        shopkeeper: shopkeeperId,
        name: String(row.name || '').trim() || 'Customer',
        phone: String(row.phone || '').trim(),
        email: String(row.email || '').trim().toLowerCase(),
        address: String(row.address || '').trim(),
        status: row.status === 'inactive' ? 'inactive' : 'active',
        creditScore: row.creditScore || 'Good',
        notes: String(row.notes || '').trim(),
        linkStatus: 'unlinked',
        balance: 0,
      };

      if (row.qrCode?.trim()) {
        const qrTaken = await Customer.findOne({ qrCode: row.qrCode.trim() });
        if (!qrTaken) payload.qrCode = row.qrCode.trim();
      }

      const created = await Customer.create(payload);
      customerIdMap.set(legacyId, created._id);
      stats.customersAdded += 1;
    }

    const resolveCustomerId = (legacyCustomerId) => {
      if (!legacyCustomerId) return null;
      return customerIdMap.get(String(legacyCustomerId)) || null;
    };

    const sortedTransactions = [...(backup.transactions || [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const row of sortedTransactions) {
      const customerId = resolveCustomerId(row.legacyCustomerId);
      if (!customerId) {
        stats.transactionsSkipped += 1;
        continue;
      }

      const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
      const duplicate = await Transaction.findOne({
        shopkeeper: shopkeeperId,
        customer: customerId,
        total: Number(row.total) || 0,
        createdAt,
      });
      if (duplicate) {
        stats.transactionsSkipped += 1;
        continue;
      }

      const items = Array.isArray(row.items) ? row.items : [];
      const normalizedItems = items.map((item) => {
        const rawUnit = String(item.unit || 'none').toLowerCase();
        const unit = rawUnit === 'kg' || rawUnit === 'ltr' ? rawUnit : 'none';
        return {
          name: String(item.name || '').trim() || 'Item',
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          unit,
        };
      });

      const total =
        Number(row.total) ||
        normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);

      await Transaction.create({
        shopkeeper: shopkeeperId,
        customer: customerId,
        items: normalizedItems,
        total,
        note: String(row.note || '').trim(),
        createdAt,
        updatedAt: createdAt,
      });

      await applyCredit(customerId, total);
      stats.transactionsAdded += 1;
    }

    const sortedPayments = [...(backup.payments || [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const row of sortedPayments) {
      const customerId = resolveCustomerId(row.legacyCustomerId);
      if (!customerId) {
        stats.paymentsSkipped += 1;
        continue;
      }

      const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
      const amount = Number(row.amount) || 0;
      if (amount <= 0) {
        stats.paymentsSkipped += 1;
        continue;
      }

      const duplicate = await Payment.findOne({
        shopkeeper: shopkeeperId,
        customer: customerId,
        amount,
        createdAt,
      });
      if (duplicate) {
        stats.paymentsSkipped += 1;
        continue;
      }

      let receiptNo = String(row.receiptNo || '').trim();
      if (receiptNo) {
        const receiptTaken = await Payment.findOne({ shopkeeper: shopkeeperId, receiptNo });
        if (receiptTaken) receiptNo = '';
      }
      if (!receiptNo) {
        receiptNo = await generateReceiptNo(shopkeeperId);
      }

      await Payment.create({
        shopkeeper: shopkeeperId,
        customer: customerId,
        amount,
        method: row.method || 'Cash',
        note: String(row.note || '').trim(),
        receiptNo,
        payType: row.payType || 'manual',
        createdAt,
        updatedAt: createdAt,
      });

      await applyPayment(customerId, amount);
      stats.paymentsAdded += 1;
    }

    for (const row of backup.products || []) {
      const name = String(row.name || '').trim();
      if (!name) continue;

      const normalizedName = name.toLowerCase();
      const existing = await Product.findOne({ shopkeeper: shopkeeperId, normalizedName });
      if (existing) {
        existing.lastPrice = Number(row.lastPrice) || existing.lastPrice;
        existing.usageCount = Math.max(existing.usageCount, Number(row.usageCount) || 0);
        if (row.lastUsedAt) existing.lastUsedAt = new Date(row.lastUsedAt);
        await existing.save();
        stats.productsUpdated += 1;
      } else {
        await Product.create({
          shopkeeper: shopkeeperId,
          name,
          normalizedName,
          lastPrice: Number(row.lastPrice) || 0,
          usageCount: Number(row.usageCount) || 0,
          lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
        });
        stats.productsAdded += 1;
      }
    }

    for (const row of backup.expenses || []) {
      const title = String(row.title || '').trim();
      if (!title) continue;

      const expenseDate = row.expenseDate ? new Date(row.expenseDate) : new Date();
      const amount = Number(row.amount) || 0;

      const duplicate = await Expense.findOne({
        shopkeeper: shopkeeperId,
        title,
        amount,
        expenseDate,
      });
      if (duplicate) {
        stats.expensesSkipped += 1;
        continue;
      }

      await Expense.create({
        shopkeeper: shopkeeperId,
        title,
        amount,
        category: row.category || 'Other',
        note: String(row.note || '').trim(),
        expenseDate,
      });
      stats.expensesAdded += 1;
    }

    const affectedCustomerIds = [...new Set([...customerIdMap.values()].map(String))];
    for (const customerId of affectedCustomerIds) {
      await recalculateBalance(customerId);
    }

    emitShopDataSync(shopkeeperId, { scopes: ['all'] });

    res.json({
      success: true,
      message: 'Backup restored successfully',
      stats,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
