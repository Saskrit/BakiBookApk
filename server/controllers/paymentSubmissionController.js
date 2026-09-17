import PaymentSubmission from '../models/PaymentSubmission.js';
import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { applyPayment, generateReceiptNo } from '../utils/customerBalance.js';
import { formatPaymentSubmission } from '../utils/formatters.js';
import { createNotification } from '../utils/notify.js';
import { emitToUser } from '../config/socket.js';
import { emitShopDataSync } from '../utils/realtimeSync.js';
import {
  findBlockingSubmission,
  findCompletedPayment,
} from '../utils/paymentStatus.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { getShopkeeperId } from '../utils/shopContext.js';
import { startTransactionSession } from '../utils/mongoSession.js';

const buildPayLabel = (submission) => {
  if (submission.payLabel) return submission.payLabel;
  if (submission.payType === 'transaction') return 'Payment for credit transaction';
  if (submission.payType === 'item') {
    return submission.itemName ? `Payment for ${submission.itemName}` : 'Payment for item';
  }
  return 'Custom payment';
};

const findLinkedCustomer = async (userId, customerId) =>
  Customer.findOne({
    _id: customerId,
    linkedUser: userId,
    linkStatus: 'linked',
  }).populate('shopkeeper', 'shopName fullName');

const validateSubmissionPayload = async ({ customer, payType, transactionId, itemIndex, amount }) => {
  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    return { error: 'Amount must be greater than zero' };
  }

  if (payType === 'custom') {
    return { parsedAmount, payLabel: 'Custom payment' };
  }

  if (!transactionId) {
    return { error: 'Transaction is required for this payment type' };
  }

  const transaction = await Transaction.findOne({
    _id: transactionId,
    customer: customer._id,
  });

  if (!transaction) {
    return { error: 'Transaction not found' };
  }

  if (payType === 'transaction') {
    return {
      parsedAmount,
      transaction,
      payLabel: `Payment for transaction (${transaction.total.toLocaleString('en-NP')} Rs.)`,
    };
  }

  if (payType === 'item') {
    const index = Number(itemIndex);
    const item = transaction.items[index];
    if (!item) {
      return { error: 'Item not found in transaction' };
    }

    const lineTotal = item.qty * item.price;
    return {
      parsedAmount,
      transaction,
      itemIndex: index,
      itemName: item.name,
      payLabel: `Payment for ${item.name} (${lineTotal.toLocaleString('en-NP')} Rs.)`,
    };
  }

  return { error: 'Invalid payment type' };
};

export const getPendingSubmissionCount = async (req, res) => {
  try {
    const count = await PaymentSubmission.countDocuments({
      shopkeeper: getShopkeeperId(req),
      status: 'pending',
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const emitPendingSubmissionCount = async (shopkeeperId) => {
  const count = await PaymentSubmission.countDocuments({
    shopkeeper: shopkeeperId,
    status: 'pending',
  });
  emitToUser(shopkeeperId.toString(), 'payment-submission:count', { count });
  return count;
};

export const submitPayment = async (req, res) => {
  try {
    const {
      customerId,
      amount,
      method,
      payType = 'custom',
      transactionId,
      itemIndex,
      screenshotUrl,
      note,
    } = req.body;

    if (!customerId || !screenshotUrl?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer and payment screenshot are required',
      });
    }

    const customer = await findLinkedCustomer(req.user._id, customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Linked shop account not found' });
    }

    const allowedMethods = ['eSewa', 'Khalti', 'Bank Transfer'];
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const allowedPayTypes = ['custom', 'transaction', 'item'];
    if (!allowedPayTypes.includes(payType)) {
      return res.status(400).json({ success: false, message: 'Invalid payment type' });
    }

    const validation = await validateSubmissionPayload({
      customer,
      payType,
      transactionId,
      itemIndex,
      amount,
    });

    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const pendingSubmission = await findBlockingSubmission(PaymentSubmission, {
      customerId: customer._id,
      payType,
      transactionId,
      itemIndex,
    });

    if (pendingSubmission) {
      return res.status(409).json({
        success: false,
        message: 'A payment for this is already pending shopkeeper review',
      });
    }

    const completedPayment = await findCompletedPayment(Payment, {
      customerId: customer._id,
      payType,
      transactionId,
      itemIndex,
    });

    if (completedPayment) {
      return res.status(409).json({
        success: false,
        message: 'This has already been paid and confirmed',
      });
    }

    const submission = await PaymentSubmission.create({
      shopkeeper: customer.shopkeeper._id || customer.shopkeeper,
      customer: customer._id,
      submittedBy: req.user._id,
      amount: validation.parsedAmount,
      method,
      payType,
      transaction: validation.transaction?._id || null,
      itemIndex: validation.itemIndex ?? null,
      itemName: validation.itemName || '',
      payLabel: validation.payLabel,
      screenshotUrl: screenshotUrl.trim(),
      note: note?.trim() || '',
    });

    await createNotification({
      userId: submission.shopkeeper,
      title: 'Payment submitted',
      body: `${customer.name} submitted Rs. ${validation.parsedAmount.toLocaleString('en-NP')} for review.`,
      type: 'info',
      customerId: customer._id,
      linkPath: '/shop/payment-submissions',
    });

    await emitPendingSubmissionCount(submission.shopkeeper);

    emitToUser(req.user._id.toString(), 'payment-submission:updated', {
      submissionId: submission._id.toString(),
      status: 'pending',
      customerId: customer._id.toString(),
    });

    emitToUser(submission.shopkeeper.toString(), 'payment-submission:updated', {
      submissionId: submission._id.toString(),
      status: 'pending',
      customerId: customer._id.toString(),
    });

    res.status(201).json({
      success: true,
      submission: formatPaymentSubmission(submission, {
        customerName: customer.name,
        shopName: customer.shopkeeper?.shopName || 'Shop',
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listCustomerSubmissions = async (req, res) => {
  try {
    const linked = await Customer.find({
      linkedUser: req.user._id,
      linkStatus: 'linked',
    }).populate('shopkeeper', 'shopName');

    const customerIds = linked.map((c) => c._id);
    const shopMap = Object.fromEntries(
      linked.map((c) => [c._id.toString(), c.shopkeeper?.shopName || 'Shop'])
    );
    const nameMap = Object.fromEntries(linked.map((c) => [c._id.toString(), c.name]));

    const submissions = await PaymentSubmission.find({ customer: { $in: customerIds } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      submissions: submissions.map((s) =>
        formatPaymentSubmission(s, {
          customerName: nameMap[s.customer.toString()],
          shopName: shopMap[s.customer.toString()],
        })
      ),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listShopkeeperSubmissions = async (req, res) => {
  try {
    const filter = { shopkeeper: getShopkeeperId(req) };
    if (req.query.status) filter.status = req.query.status;

    const { page, limit, skip } = parsePagination(req.query);
    const [total, submissions] = await Promise.all([
      PaymentSubmission.countDocuments(filter),
      PaymentSubmission.find(filter)
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({
      success: true,
      submissions: submissions.map((s) =>
        formatPaymentSubmission(s, {
          customerName: s.customer?.name,
        })
      ),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopkeeperSubmission = async (req, res) => {
  try {
    const submission = await PaymentSubmission.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    }).populate('customer', 'name');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.json({
      success: true,
      submission: formatPaymentSubmission(submission, {
        customerName: submission.customer?.name,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const finalizeReview = async (submission, customer, status, extra = {}) => {
  submission.status = status;
  submission.reviewedAt = new Date();
  Object.assign(submission, extra);
  await submission.save();

  const statusMessages = {
    accepted: 'accepted and recorded',
    rejected: 'rejected',
    reported: 'reported for review',
  };

  if (customer.linkedUser) {
    await createNotification({
      userId: customer.linkedUser,
      title: `Payment ${status}`,
      body: `Your Rs. ${submission.amount.toLocaleString('en-NP')} payment was ${statusMessages[status]}.${extra.reviewNote ? ` Note: ${extra.reviewNote}` : ''}`,
      type: status === 'accepted' ? 'success' : 'warning',
      customerId: customer._id,
    });

    emitToUser(customer.linkedUser.toString(), 'payment-submission:updated', {
      submissionId: submission._id.toString(),
      status,
      customerId: customer._id.toString(),
      paymentId: submission.payment?.toString?.() || submission.payment || null,
    });
  }

  await emitShopDataSync(submission.shopkeeper, {
    scopes: ['dashboard', 'customers', 'payments', 'all'],
  });
};

export const acceptSubmission = async (req, res) => {
  const session = await startTransactionSession();

  try {
    const shopkeeperId = getShopkeeperId(req);
    const reviewNote = req.body.note?.trim() || '';

    const existing = await PaymentSubmission.findOne({
      _id: req.params.id,
      shopkeeper: shopkeeperId,
    })
      .populate('customer', 'name linkedUser linkStatus')
      .session(session);

    if (!existing) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (existing.status === 'accepted' && existing.payment) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: 'Payment already accepted',
        submission: formatPaymentSubmission(existing, {
          customerName: existing.customer?.name,
        }),
        paymentId: existing.payment.toString(),
      });
    }

    if (existing.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Submission is already ${existing.status}`,
      });
    }

    const claimed = await PaymentSubmission.findOneAndUpdate(
      {
        _id: req.params.id,
        shopkeeper: shopkeeperId,
        status: 'pending',
      },
      {
        $set: {
          status: 'accepted',
          reviewedAt: new Date(),
          reviewNote,
        },
      },
      { new: true, session }
    ).populate('customer', 'name linkedUser linkStatus');

    if (!claimed) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Submission was already processed',
      });
    }

    const customer = claimed.customer;
    const receiptNo = await generateReceiptNo(shopkeeperId);
    const payLabel = buildPayLabel(claimed);
    const noteParts = [claimed.note, payLabel].filter(Boolean);

    const [payment] = await Payment.create(
      [
        {
          shopkeeper: claimed.shopkeeper,
          customer: customer._id,
          amount: claimed.amount,
          method: claimed.method,
          note: noteParts.join(' | '),
          receiptNo,
          screenshotUrl: claimed.screenshotUrl,
          payType: claimed.payType,
          transaction: claimed.transaction,
          itemIndex: claimed.itemIndex ?? null,
          itemName: claimed.itemName || '',
          payLabel,
          submission: claimed._id,
        },
      ],
      { session }
    );

    await applyPayment(customer._id, claimed.amount, session);

    claimed.payment = payment._id;
    await claimed.save({ session });

    await session.commitTransaction();

    if (customer.linkedUser) {
      await createNotification({
        userId: customer.linkedUser,
        title: 'Payment accepted',
        body: `Your Rs. ${claimed.amount.toLocaleString('en-NP')} payment was accepted and recorded.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        type: 'success',
        customerId: customer._id,
      });

      emitToUser(customer.linkedUser.toString(), 'payment-submission:updated', {
        submissionId: claimed._id.toString(),
        status: 'accepted',
        customerId: customer._id.toString(),
        paymentId: payment._id.toString(),
      });
    }

    await createNotification({
      userId: shopkeeperId,
      title: 'Payment accepted',
      body: `${customer.name} payment of Rs. ${claimed.amount.toLocaleString('en-NP')} recorded.`,
      type: 'success',
      customerId: customer._id,
      linkPath: `/shop/payments/${payment._id}`,
    });

    await emitPendingSubmissionCount(shopkeeperId);

    res.json({
      success: true,
      message: 'Payment accepted and balance updated',
      submission: formatPaymentSubmission(claimed, { customerName: customer.name }),
      paymentId: payment._id.toString(),
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Payment for this submission already exists',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

export const rejectSubmission = async (req, res) => {
  try {
    const submission = await PaymentSubmission.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
      status: 'pending',
    }).populate('customer', 'name linkedUser linkStatus');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Pending submission not found' });
    }

    const reviewNote = req.body.note?.trim() || '';
    if (!reviewNote) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    await finalizeReview(submission, submission.customer, 'rejected', { reviewNote });

    await emitPendingSubmissionCount(getShopkeeperId(req));

    res.json({
      success: true,
      message: 'Payment submission rejected',
      submission: formatPaymentSubmission(submission, {
        customerName: submission.customer.name,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reportSubmission = async (req, res) => {
  try {
    const submission = await PaymentSubmission.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
      status: 'pending',
    }).populate('customer', 'name linkedUser linkStatus');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Pending submission not found' });
    }

    const reportReason = req.body.reason?.trim() || req.body.note?.trim() || '';
    if (!reportReason) {
      return res.status(400).json({ success: false, message: 'Report reason is required' });
    }

    await finalizeReview(submission, submission.customer, 'reported', {
      reportReason,
      reviewNote: reportReason,
    });

    await emitPendingSubmissionCount(getShopkeeperId(req));

    res.json({
      success: true,
      message: 'Payment submission reported',
      submission: formatPaymentSubmission(submission, {
        customerName: submission.customer.name,
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
