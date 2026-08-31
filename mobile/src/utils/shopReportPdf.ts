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

type CompleteReportPayload = {
  period: string;
  shopName?: string;
  shopOwner?: string;
  report: Record<string, unknown>;
  credits?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  products?: Array<Record<string, unknown>>;
  activity?: Array<Record<string, unknown>>;
  customers?: Array<Record<string, unknown>>;
  outstanding?: Array<Record<string, unknown>>;
};

function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options);
}

function summaryItems(report: Record<string, unknown>): Array<[string, string]> {
  return [
    [t('pdf.periodStart'), formatReportDate(String(report.periodStart || ''))],
    [t('pdf.periodEnd'), formatReportDate(String(report.periodEnd || ''))],
    [t('pdf.creditGiven'), formatRs(Number(report.creditGiven || 0))],
    [t('pdf.paymentsReceived'), formatRs(Number(report.paymentsReceived || 0))],
    [t('pdf.creditTransactions'), String(report.transactionCount ?? 0)],
    [t('pdf.paymentRecords'), String(report.paymentCount ?? 0)],
    [t('pdf.productLineItems'), String(report.productCount ?? 0)],
    [t('pdf.totalCustomers'), String(report.customerCount ?? 0)],
    [t('pdf.customersWithDues'), String(report.customersWithDues ?? 0)],
    [t('pdf.totalOutstanding'), formatRs(Number(report.totalOutstanding || 0))],
  ];
}

export async function exportCompleteShopReportPdf(data: CompleteReportPayload) {
  const { period, shopName, shopOwner, report } = data;
  const statsHtml = buildStatsTableHtml(summaryItems(report));

  const creditsHtml = buildTableHtml(data.credits, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colCustomer'), key: 'customer' },
    {
      label: t('pdf.colProducts'),
      key: 'products',
      format: (_, row) => String(row.products || row.items || '—'),
    },
    { label: t('pdf.colTotal'), key: 'total', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colNote'), key: 'note' },
  ]);

  const paymentsHtml = buildTableHtml(data.payments, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colCustomer'), key: 'customer' },
    {
      label: t('pdf.colPaidFor'),
      key: 'paidFor',
      format: (_, row) =>
        String(row.paidFor || row.itemName || row.payLabel || row.note || '—'),
    },
    { label: t('pdf.colAmount'), key: 'amount', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colMethod'), key: 'method' },
    {
      label: t('pdf.colReceipt'),
      key: 'receipt',
      format: (_, row) => String(row.receipt || row.receiptNo || '—'),
    },
  ]);

  const productsHtml = buildTableHtml(data.products, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colCustomer'), key: 'customer' },
    { label: t('pdf.colProduct'), key: 'product' },
    {
      label: t('pdf.colQty'),
      key: 'qty',
      format: (v, row) => {
        const unit = row.unit === 'kg' || row.unit === 'ltr' ? ` ${row.unit}` : '';
        return `${v ?? 1}${unit}`;
      },
    },
    {
      label: t('pdf.colUnitPrice'),
      key: 'unitPrice',
      format: (v, row) => formatRs(Number(v ?? row.price ?? 0)),
    },
    {
      label: t('pdf.colLineTotal'),
      key: 'lineTotal',
      format: (v, row) => formatRs(Number(v ?? row.total ?? 0)),
    },
  ]);

  const activityHtml = buildTableHtml(data.activity, [
    { label: t('pdf.colDate'), key: 'date' },
    { label: t('pdf.colType'), key: 'type' },
    { label: t('pdf.colCustomer'), key: 'customer' },
    {
      label: t('pdf.colDetails'),
      key: 'detail',
      format: (_, row) =>
        String(row.detail || row.details || row.products || row.note || '—'),
    },
    { label: t('pdf.colAmount'), key: 'amount', format: (v) => formatRs(Number(v)) },
  ]);

  const customersHtml = buildTableHtml(data.customers, [
    { label: t('pdf.colName'), key: 'name' },
    { label: t('pdf.colPhone'), key: 'phone' },
    { label: t('pdf.colBalance'), key: 'balance', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colCreditScore'), key: 'creditScore' },
    { label: t('pdf.colStatus'), key: 'status' },
  ]);

  const outstandingHtml = buildTableHtml(data.outstanding, [
    { label: t('pdf.colName'), key: 'name' },
    { label: t('pdf.colPhone'), key: 'phone' },
    { label: t('pdf.colOutstanding'), key: 'balance', format: (v) => formatRs(Number(v)) },
    { label: t('pdf.colCreditScore'), key: 'creditScore' },
  ]);

  const generatedDate = formatReportDate(new Date().toISOString());
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${PDF_STYLES}</style></head><body>
    <h1>${escapeHtml(t('pdf.shopReportTitle', { period }))}</h1>
    <div class="meta">
      <div><strong>${escapeHtml(shopName || t('pdf.shop'))}</strong>${shopOwner ? ` · ${escapeHtml(shopOwner)}` : ''}</div>
      <div>${escapeHtml(t('pdf.generated', { date: generatedDate }))}</div>
    </div>
    <h2>${escapeHtml(t('pdf.summary'))}</h2>
    ${statsHtml}
    <h2>${escapeHtml(t('pdf.creditTransactions'))}</h2>${creditsHtml}
    <h2>${escapeHtml(t('pdf.paymentsReceived'))}</h2>${paymentsHtml}
    <h2>${escapeHtml(t('pdf.productsSoldOnCredit'))}</h2>${productsHtml}
    <h2>${escapeHtml(t('pdf.activityLog'))}</h2>${activityHtml}
    <h2>${escapeHtml(t('pdf.allCustomers'))}</h2>${customersHtml}
    <h2>${escapeHtml(t('pdf.outstandingBalances'))}</h2>${outstandingHtml}
    <div class="footer">${escapeHtml(t('pdf.footerShop'))}</div>
  </body></html>`;

  await shareHtmlAsPdf(html, t('pdf.exportShopReport'), {
    fileName: `BakiBook_Shop_${period}_${new Date().toISOString().slice(0, 10)}`,
  });
}
