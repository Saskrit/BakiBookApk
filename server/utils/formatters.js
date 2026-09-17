import { toPublicImageUrl } from './imageUpload.js';

export const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatRelativeDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatNotificationWhen = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  const time = formatTime(date);

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;

  const dateLabel = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${dateLabel}, ${time}`;
};

export const formatCustomer = (customer) => {
  const linkedUser =
    customer.linkedUser && typeof customer.linkedUser === 'object' ? customer.linkedUser : null;
  const profileImage =
    customer.linkStatus === 'linked' && linkedUser?.profileImage
      ? toPublicImageUrl(linkedUser.profileImage)
      : '';

  return {
  id: customer._id.toString(),
  name: customer.name,
  phone: customer.phone || '',
  email: customer.email || '',
  address: customer.address || '',
  status: customer.status,
  creditScore: customer.creditScore,
  balance: customer.balance,
  avatar: getInitials(customer.name),
  profileImage,
  notes: customer.notes || '',
  joined: formatDate(customer.createdAt),
  qrCode: customer.qrCode,
  lastCreditDate: customer.lastCreditDate,
  lastPaymentDate: customer.lastPaymentDate,
  linkStatus: customer.linkStatus || 'unlinked',
  isLinked: customer.linkStatus === 'linked',
  linkedUserId: linkedUser?._id?.toString?.() || customer.linkedUser?.toString?.() || null,
};
};

export const formatCreditProducts = (items = []) => {
  if (!items?.length) return '—';
  return items
    .map((item) => {
      const unit = item.unit === 'kg' || item.unit === 'ltr' ? ` ${item.unit}` : '';
      return `${item.name} ×${item.qty}${unit}`;
    })
    .join(', ');
};

export const buildPaymentForLabel = (payment, submission = null) => {
  const itemName = payment?.itemName || submission?.itemName;
  if (itemName) return itemName;

  const payLabel = payment?.payLabel || submission?.payLabel;
  if (payLabel) {
    return payLabel
      .replace(/^Payment for /i, '')
      .replace(/ \([\d,]+ Rs\.\)$/, '');
  }

  const note = payment?.note || '';
  if (note.includes('Payment for')) {
    const labelPart = note.split(' | ').find((part) => part.trim().startsWith('Payment for'));
    if (labelPart) {
      return labelPart
        .trim()
        .replace(/^Payment for /i, '')
        .replace(/ \([\d,]+ Rs\.\)$/, '');
    }
  }

  const payType = payment?.payType || submission?.payType || 'manual';
  if (payType === 'transaction') return 'Full credit bill';
  if (payType === 'custom') return 'Custom amount';
  return 'General payment';
};

export const formatTransaction = (tx, customerName) => ({
  id: tx._id.toString(),
  customerId: tx.customer?.toString?.() || tx.customer,
  customerName: customerName || tx.customerName || '',
  type: tx.type,
  items: tx.items,
  products: formatCreditProducts(tx.items),
  total: tx.total,
  date: formatDate(tx.createdAt),
  time: formatTime(tx.createdAt),
  note: tx.note || '',
});

export const formatPayment = (payment, customerName, extras = {}) => {
  const submission = extras.submission;
  return {
    id: payment._id.toString(),
    customerId: payment.customer?.toString?.() || payment.customer,
    customerName: customerName || payment.customerName || '',
    amount: payment.amount,
    method: payment.method,
    date: formatDate(payment.createdAt),
    time: formatTime(payment.createdAt),
    note: payment.note || '',
    receiptNo: payment.receiptNo,
    screenshotUrl: toPublicImageUrl(payment.screenshotUrl || submission?.screenshotUrl || ''),
    payType: payment.payType || submission?.payType || 'manual',
    payLabel: payment.payLabel || submission?.payLabel || '',
    itemName: payment.itemName || submission?.itemName || '',
    transactionId:
      payment.transaction?.toString?.() ||
      payment.transaction ||
      submission?.transaction?.toString?.() ||
      null,
    paidFor: buildPaymentForLabel(payment, submission),
  };
};

export const formatPaymentSubmission = (submission, extras = {}) => ({
  id: submission._id.toString(),
  customerId: submission.customer?.toString?.() || submission.customer,
  customerName: extras.customerName || submission.customerName || '',
  shopName: extras.shopName || '',
  amount: submission.amount,
  method: submission.method,
  payType: submission.payType,
  payLabel: submission.payLabel || '',
  transactionId: submission.transaction?.toString?.() || submission.transaction || null,
  itemIndex: submission.itemIndex,
  itemName: submission.itemName || '',
  screenshotUrl: toPublicImageUrl(submission.screenshotUrl || ''),
  note: submission.note || '',
  status: submission.status,
  reviewNote: submission.reviewNote || '',
  reportReason: submission.reportReason || '',
  paymentId: submission.payment?.toString?.() || submission.payment || null,
  date: formatDate(submission.createdAt),
  time: formatTime(submission.createdAt),
  reviewedAt: submission.reviewedAt ? formatDate(submission.reviewedAt) : null,
});

export const formatNotification = (n) => ({
  id: n._id.toString(),
  title: n.title,
  body: n.body,
  type: n.type,
  date: formatNotificationWhen(n.createdAt),
  time: formatTime(n.createdAt),
  createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
  read: n.read,
  archived: Boolean(n.archived),
  linkPath: n.linkPath || '',
  customerId: n.customer?.toString?.() || n.customer || null,
});
