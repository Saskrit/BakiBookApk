import {
  formatCreditProducts,
  formatDate,
  formatPayment,
  formatTime,
  buildPaymentForLabel,
} from './formatters.js';

const toId = (value) => value?.toString?.() || value || '';

function isProductLinkedPayment(payment) {
  return payment.payType === 'transaction' || payment.payType === 'item';
}

function paymentVisibleForRole(payment, role, filter) {
  const customerArchived = Boolean(payment.customerArchived);
  const shopkeeperHidden = Boolean(payment.shopkeeperHidden);

  if (role === 'customer') {
    if (filter === 'archived') return customerArchived;
    if (filter === 'active') return !customerArchived;
    return true;
  }

  if (filter === 'archived') return false;
  if (filter === 'active') return !shopkeeperHidden;
  return true;
}

function transactionFullySettled(tx, payments) {
  const txId = toId(tx._id);
  if (payments.some((p) => toId(p.transaction) === txId && p.payType === 'transaction')) {
    return true;
  }

  const itemPayments = payments.filter(
    (p) => toId(p.transaction) === txId && p.payType === 'item'
  );
  if (!itemPayments.length) return false;

  return (tx.items || []).every((_, index) =>
    itemPayments.some((p) => Number(p.itemIndex) === index)
  );
}

function buildPaidDescription(tx, payment) {
  if (payment.payType === 'item') {
    const item = tx?.items?.[payment.itemIndex];
    if (item) return `${item.name} ×${item.qty}`;
    return payment.itemName || payment.payLabel || 'Product payment';
  }

  if (tx?.items?.length) {
    return formatCreditProducts(tx.items);
  }

  return payment.payLabel || payment.itemName || 'Credit bill';
}

function buildPaidCreditAmount(tx, payment) {
  if (payment.payType === 'item') {
    const item = tx?.items?.[payment.itemIndex];
    return item ? item.qty * item.price : payment.amount;
  }
  return tx?.total ?? payment.amount;
}

export function buildGroupedLedger({
  transactions = [],
  payments = [],
  role = 'shopkeeper',
  filter = 'active',
  shopName = null,
  includeRunningBalance = false,
}) {
  const txMap = new Map(transactions.map((tx) => [toId(tx._id), tx]));
  const consumedPaymentIds = new Set();
  const consumedTransactionIds = new Set();
  const internalEntries = [];

  for (const payment of payments) {
    if (!isProductLinkedPayment(payment)) continue;
    if (!paymentVisibleForRole(payment, role, filter)) continue;

    const txId = toId(payment.transaction);
    const tx = txMap.get(txId);
    if (!tx) continue;

    const products = buildPaidDescription(tx, payment);
    const creditAmount = buildPaidCreditAmount(tx, payment);
    const formatted = formatPayment(payment, '', { submission: payment.submission });

    consumedPaymentIds.add(toId(payment._id));
    if (payment.payType === 'transaction') {
      consumedTransactionIds.add(txId);
    }

    internalEntries.push({
      kind: 'paid',
      paymentId: toId(payment._id),
      transactionId: txId,
      date: formatDate(payment.createdAt),
      time: formatTime(payment.createdAt),
      type: 'Paid',
      label: 'Paid',
      desc: products,
      products,
      items: products,
      creditAmount,
      paymentAmount: payment.amount,
      method: payment.method,
      receipt: payment.receiptNo,
      paidFor: formatted.paidFor || buildPaymentForLabel(payment, payment.submission),
      customerArchived: Boolean(payment.customerArchived),
      shopkeeperHidden: Boolean(payment.shopkeeperHidden),
      shopName,
      sortAt: new Date(payment.createdAt),
      balanceDelta: 0,
      amountDisplay: `Rs. ${payment.amount.toLocaleString('en-NP')} paid`,
    });
  }

  for (const tx of transactions) {
    const txId = toId(tx._id);
    if (consumedTransactionIds.has(txId)) continue;
    if (transactionFullySettled(tx, payments)) continue;

    internalEntries.push({
      kind: 'credit',
      id: txId,
      date: formatDate(tx.createdAt),
      time: formatTime(tx.createdAt),
      type: 'Credit',
      label: 'Credit',
      desc: formatCreditProducts(tx.items) || tx.note || 'Credit purchase',
      products: formatCreditProducts(tx.items),
      items: formatCreditProducts(tx.items) || tx.note || 'Credit purchase',
      creditAmount: tx.total,
      shopName,
      sortAt: new Date(tx.createdAt),
      balanceDelta: tx.total,
      amountDisplay: `+ Rs. ${tx.total.toLocaleString('en-NP')}`,
    });
  }

  for (const payment of payments) {
    const paymentId = toId(payment._id);
    if (consumedPaymentIds.has(paymentId)) continue;
    if (!paymentVisibleForRole(payment, role, filter)) continue;
    if (role === 'shopkeeper' && payment.shopkeeperHidden && filter === 'active') continue;

    const formatted = formatPayment(payment, '', { submission: payment.submission });
    const paidFor = formatted.paidFor || buildPaymentForLabel(payment, payment.submission);

    internalEntries.push({
      kind: 'payment',
      id: paymentId,
      paymentId,
      date: formatDate(payment.createdAt),
      time: formatTime(payment.createdAt),
      type: 'Payment',
      label: 'Payment',
      desc: paidFor,
      products: paidFor,
      items: paidFor,
      paymentAmount: payment.amount,
      method: payment.method,
      receipt: payment.receiptNo,
      shopName,
      sortAt: new Date(payment.createdAt),
      balanceDelta: -payment.amount,
      amountDisplay: `- Rs. ${payment.amount.toLocaleString('en-NP')}`,
    });
  }

  internalEntries.sort((a, b) => a.sortAt - b.sortAt);

  let running = 0;
  const withBalance = internalEntries.map((entry) => {
    running += entry.balanceDelta || 0;
    running = Math.max(0, running);
    return {
      ...entry,
      runningBalance: running,
      balance: includeRunningBalance ? `Rs. ${running.toLocaleString('en-NP')}` : undefined,
      amount: entry.amountDisplay,
    };
  });

  const ledger = withBalance
    .reverse()
    .map(({ sortAt, balanceDelta, runningBalance, ...row }) => ({
      id: row.id || `paid-${row.paymentId}`,
      sortAt: sortAt?.toISOString?.() || null,
      runningBalance,
      ...row,
    }));

  return ledger;
}

export function countArchivedPaidEntries(payments = [], role = 'customer') {
  return payments.filter(
    (p) =>
      isProductLinkedPayment(p) &&
      (role === 'customer' ? p.customerArchived : p.shopkeeperHidden)
  ).length;
}
