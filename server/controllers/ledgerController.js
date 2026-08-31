import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import { formatCustomer, formatDate, formatNotification } from '../utils/formatters.js';
import { createNotification, emitNotificationCount } from '../utils/notify.js';
import { parsePagination, paginateArray } from '../utils/pagination.js';
import { buildGroupedLedger } from '../utils/groupedLedger.js';

import { getShopkeeperId } from '../utils/shopContext.js';

export const getLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({
      _id: customerId,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const [transactions, payments] = await Promise.all([
      Transaction.find({ customer: customerId }).sort({ createdAt: 1 }),
      Payment.find({ customer: customerId })
        .populate('submission', 'itemName payLabel payType itemIndex transaction')
        .sort({ createdAt: 1 }),
    ]);

    const filter = req.query.filter === 'archived' ? 'archived' : 'active';
    const ledger = buildGroupedLedger({
      transactions,
      payments,
      role: 'shopkeeper',
      filter,
      includeRunningBalance: true,
    });

    const { page, limit } = parsePagination(req.query);
    const { items, pagination } = paginateArray(ledger, page, limit);

    res.json({
      success: true,
      customer: formatCustomer(customer),
      ledger: items,
      pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOutstanding = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const dueCustomers = await Customer.find({
      shopkeeper: shopkeeperId,
      balance: { $gt: 0 },
    }).sort({ balance: -1 });

    const totalOutstanding = dueCustomers.reduce((sum, c) => sum + c.balance, 0);
    const avgDue = dueCustomers.length ? totalOutstanding / dueCustomers.length : 0;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const collectedAgg = await Payment.aggregate([
      { $match: { shopkeeper: shopkeeperId, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const formatted = dueCustomers.map(formatCustomer);
    const { page, limit, skip } = parsePagination(req.query);
    const { items, pagination } = paginateArray(formatted, page, limit);

    res.json({
      success: true,
      summary: {
        totalOutstanding,
        customersWithDues: dueCustomers.length,
        avgDue: Math.round(avgDue),
        collectedThisMonth: collectedAgg[0]?.total || 0,
      },
      customers: items,
      pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOverdue = async (req, res) => {
  try {
    const customers = await Customer.find({
      shopkeeper: getShopkeeperId(req),
      balance: { $gt: 0 },
      creditScore: { $in: ['Risky', 'Defaulter', 'Average'] },
    }).sort({ balance: -1 });

    const formatted = customers.map(formatCustomer);
    const { page, limit, skip } = parsePagination(req.query);
    const { items, pagination } = paginateArray(formatted, page, limit);

    res.json({ success: true, customers: items, pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReminders = async (req, res) => {
  try {
    const customers = await Customer.find({
      shopkeeper: getShopkeeperId(req),
      balance: { $gt: 0 },
    }).sort({ lastCreditDate: 1 });

    const reminders = customers.map((c) => {
      const refDate = c.lastCreditDate || c.createdAt;
      const daysOverdue = Math.floor((Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: c._id.toString(),
        customerId: c._id.toString(),
        name: c.name,
        amount: c.balance,
        daysOverdue,
      };
    });

    const { page, limit } = parsePagination(req.query);
    const { items, pagination } = paginateArray(reminders, page, limit);

    res.json({ success: true, reminders: items, pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendReminder = async (req, res) => {
  try {
    const { customerId, channel, message } = req.body;

    const customer = await Customer.findOne({
      _id: customerId,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const body =
      message?.trim() ||
      `Namaste ${customer.name}, friendly reminder: Rs. ${customer.balance.toLocaleString('en-NP')} outstanding. Please contact us to settle.`;

    await createNotification({
      userId: getShopkeeperId(req),
      title: 'Due reminder sent',
      body: `Reminder sent to ${customer.name} via ${channel || 'in-app'}.`,
      type: 'info',
      customerId,
      linkPath: '/shop/reminders',
    });

    if (customer.linkedUser && customer.linkStatus === 'linked') {
      await createNotification({
        userId: customer.linkedUser,
        title: 'Payment reminder',
        body,
        type: 'warning',
        customerId,
      });
    }

    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { user: req.user._id };

    if (req.query.filter === 'unread') {
      filter.read = false;
      filter.archived = false;
    } else if (req.query.filter === 'archived') {
      filter.archived = true;
    } else {
      filter.archived = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      notifications: notifications.map(formatNotification),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
      await emitNotificationCount(req.user._id);
    }

    res.json({ success: true, notification: formatNotification(notification) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
      await emitNotificationCount(req.user._id);
    }

    res.json({ success: true, notification: formatNotification(notification) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const archiveNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { archived: true, read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await emitNotificationCount(req.user._id);
    res.json({ success: true, notification: formatNotification(notification) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unarchiveNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { archived: false },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification: formatNotification(notification) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await emitNotificationCount(req.user._id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false, archived: false },
      { read: true }
    );
    await emitNotificationCount(req.user._id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
      archived: false,
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
