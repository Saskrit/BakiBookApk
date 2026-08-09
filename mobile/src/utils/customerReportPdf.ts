import type { Customer } from '../types';
import i18n from '../i18n';
import {
  PDF_STYLES,
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

function flattenProducts(credits: Array<Record<string, unknown>>) {
  const products: Array<Record<string, unknown>> = [];
  for (const credit of credits) {
    const items = (credit.items as Array<{ name: string; qty: number; price: number }>) || [];
    for (const item of items) {
      products.push({
        date: credit.date,
        product: item.name,
        qty: item.qty,
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

  const statsHtml = [
    [t('pdf.outstandingDue'), formatRs(summary.balance ?? customer.balance)],
    [t('pdf.totalCreditGiven'), formatRs(summary.totalCredit ?? 0)],
    [t('pdf.totalPaid'), formatRs(summary.totalPaid ?? 0)],
    [t('pdf.creditTransactions'), String(summary.transactionCount ?? credits.length)],
    [t('pdf.payments'), String(summary.paymentCount ?? payments.length)],
  ]
    .map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');

  const profileHtml = profileItems
    .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join('');

  const creditsHtml = buildTableHtml(credits, [
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
    { label: t('pdf.colPaidFor'), key: 'paidFor' },
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
      format: (_, row) => String(row.desc || row.items || row.products || '—'),
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
    <h2>${escapeHtml(t('pdf.summary'))}</h2><div class="stats">${statsHtml}</div>
    <h2>${escapeHtml(t('pdf.profile'))}</h2><div class="profile">${profileHtml}</div>
    <h2>${escapeHtml(t('pdf.creditTransactions'))}</h2>${creditsHtml}
    <h2>${escapeHtml(t('pdf.productsPurchased'))}</h2>${productsHtml}
    <h2>${escapeHtml(t('pdf.payments'))}</h2>${paymentsHtml}
    <h2>${escapeHtml(t('pdf.accountLedger'))}</h2>${ledgerHtml}
    <div class="footer">${escapeHtml(t('pdf.footerCustomer'))}</div>
  </body></html>`;

  await shareHtmlAsPdf(html, t('pdf.exportCustomerReport'));
}
