import type { Customer } from '../types';
import i18n from '../i18n';
import {
  PDF_STYLES,
  buildStatsTableHtml,
  buildTableHtml,
  escapeHtml,
  formatReportDate,
  formatRs,
  shareHtmlAsPdf,
} from './pdfHtml';

type CustomerReportData = {
  shopName?: string;
  shopOwner?: string;
  customer: Customer;
  summary: {
    balance?: number;
    totalCredit?: number;
    totalPaid?: number;
    transactionCount?: number;
    paymentCount?: number;
  };
  ledger: Array<Record<string, unknown>>;
  credits: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
};

function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options);
}

function formatItemQty(item: { qty?: number; unit?: string }) {
  const qty = item.qty ?? 1;
  if (item.unit === 'kg' || item.unit === 'ltr') return `${qty} ${item.unit}`;
  return String(qty);
}

function formatProductsLine(
  credit: Record<string, unknown>
): string {
  if (typeof credit.products === 'string' && credit.products.trim()) {
    return credit.products;
  }
  const items =
    (credit.items as Array<{ name: string; qty: number; price?: number; unit?: string }>) || [];
  if (!items.length) return '—';
  return items
    .map((item) => `${item.name} ×${formatItemQty(item)} @ ${formatRs(Number(item.price || 0))}`)
    .join(', ');
}

function flattenProducts(credits: Array<Record<string, unknown>>) {
  const products: Array<Record<string, unknown>> = [];
  for (const credit of credits) {
    const items =
      (credit.items as Array<{ name: string; qty: number; price: number; unit?: string }>) || [];
    for (const item of items) {
      products.push({
        date: credit.date,
        time: credit.time,
        product: item.name,
        qty: formatItemQty(item),
        unitPrice: item.price,
        lineTotal: (item.qty || 0) * (item.price || 0),
      });
    }
  }
  return products;
}

export async function exportCustomerReportPdf(data: CustomerReportData) {
  const { customer, summary, ledger, credits, payments, shopName, shopOwner } = data;
  const products = flattenProducts(credits);
  const linkLabel =
    customer.linkStatus === 'linked' ? t('pdf.linkedAccount') : t('pdf.notLinked');

  const profileItems: [string, string][] = [
    [t('pdf.colPhone'), customer.phone || '—'],
    [t('auth.email'), customer.email || '—'],
    [t('pdf.colAddress'), customer.address || '—'],
    [t('pdf.colCreditScore'), customer.creditScore || '—'],
    [t('pdf.accountLink'), linkLabel],
    [t('pdf.colStatus'), customer.status || '—'],
  ];
  if (customer.notes?.trim()) {
    profileItems.push([t('pdf.notes'), customer.notes.trim()]);
  }

  const statsHtml = buildStatsTableHtml([
    [t('pdf.outstandingDue'), formatRs(summary.balance ?? customer.balance)],
    [t('pdf.totalCreditGiven'), formatRs(summary.totalCredit ?? 0)],
    [t('pdf.totalPaid'), formatRs(summary.totalPaid ?? 0)],
    [t('pdf.creditTransactions'), String(summary.transactionCount ?? credits.length)],
    [t('pdf.payments'), String(summary.paymentCount ?? payments.length)],
  ]);

  const profileHtml = profileItems
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join('');

  const creditRows = credits.map((tx) => ({
    ...tx,
    products: formatProductsLine(tx),
  }));

  const creditsHtml = buildTableHtml(creditRows, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colTime'), key: 'time' },
    { label: t('pdf.colProducts'), key: 'products' },
    { label: t('pdf.colTotal'), key: 'total', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colNote'), key: 'note' },
  ]);

  const productsHtml = buildTableHtml(products, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colProduct'), key: 'product' },
    { label: t('pdf.colQty'), key: 'qty' },
    { label: t('pdf.colUnitPrice'), key: 'unitPrice', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colLineTotal'), key: 'lineTotal', format: (v) => formatRs(Number(v)) },
  ]);

  const paymentsHtml = buildTableHtml(payments, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colTime'), key: 'time' },
    {
      label: t('pdf.colPaidFor'),
      key: 'paidFor',
      format: (_, row) =>
        String(row.paidFor || row.itemName || row.payLabel || row.note || '—'),
    },
    { label: t('pdf.colAmount'), key: 'amount', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colMethod'), key: 'method' },
    { label: t('pdf.colReceipt'), key: 'receiptNo' },
  ]);

  const ledgerHtml = buildTableHtml(ledger, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colTime'), key: 'time' },
    { label: t('pdf.colType'), key: 'type' },
    {
      label: t('pdf.colDescription'),
      key: 'desc',
      format: (_, row) => String(row.desc || row.items || row.products || row.label || '—'),
    },
    { label: t('pdf.colAmount'), key: 'amount' },
    { label: t('pdf.colBalance'), key: 'balance' },
  ]);

  const generatedDate = formatReportDate(new Date().toISOString());
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${PDF_STYLES}</style></head><body>
    <h1>${escapeHtml(t('pdf.customerReportTitle', { name: customer.name }))}</h1>
    <div class="meta">
      <div><strong>${escapeHtml(shopName || t('pdf.shop'))}</strong>${shopOwner ? ` · ${escapeHtml(shopOwner)}` : ''}</div>
      <div>${escapeHtml(t('pdf.generated', { date: generatedDate }))}</div>
    </div>
    <h2>${escapeHtml(t('pdf.summary'))}</h2>${statsHtml}
    <h2>${escapeHtml(t('pdf.profile'))}</h2><div class="profile">${profileHtml}</div>
    <h2>${escapeHtml(t('pdf.creditTransactions'))}</h2>${creditsHtml}
    <h2>${escapeHtml(t('pdf.productsPurchased'))}</h2>${productsHtml}
    <h2>${escapeHtml(t('pdf.payments'))}</h2>${paymentsHtml}
    <h2>${escapeHtml(t('pdf.accountLedger'))}</h2>${ledgerHtml}
    <div class="footer">${escapeHtml(t('pdf.footerCustomer'))}</div>
  </body></html>`;

  const safeName = String(customer.name || 'Customer').replace(/\s+/g, '_');
  await shareHtmlAsPdf(html, t('pdf.exportCustomerReport'), {
    fileName: `BakiBook_Customer_${safeName}_${new Date().toISOString().slice(0, 10)}`,
  });
}
