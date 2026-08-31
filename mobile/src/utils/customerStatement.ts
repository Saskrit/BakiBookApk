import { fetchPortalDashboard, fetchPortalLedger } from '../api/portal';
import { formatRs } from './format';
import {
  buildStatsTableHtml,
  buildTableHtml,
  escapeHtml,
  formatReportDate,
  PDF_STYLES,
  shareHtmlAsPdf,
} from './pdfHtml';
import i18n from '../i18n';

type StatementOptions = {
  fullName?: string;
  email?: string;
  customerId?: string;
  shopName?: string;
};

export async function exportCustomerStatement(options: StatementOptions = {}) {
  const t = i18n.t.bind(i18n);
  const [ledgerRes, dashboard] = await Promise.all([
    fetchPortalLedger(),
    fetchPortalDashboard().catch(() => null),
  ]);

  let ledger = ledgerRes.ledger || [];
  if (options.customerId) {
    ledger = ledger.filter(
      (item) => String(item.customerId || '') === String(options.customerId)
    );
  } else if (options.shopName) {
    ledger = ledger.filter(
      (item) => String(item.shopName || '').toLowerCase() === options.shopName!.toLowerCase()
    );
  }

  const due = dashboard?.summary?.currentDue || 0;
  const purchases = dashboard?.summary?.totalPurchases || 0;
  const paid = dashboard?.summary?.totalPaid || 0;

  const titleSuffix = options.shopName ? ` · ${options.shopName}` : '';
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (options.fullName || 'Customer').replace(/[^\w\-]+/g, '_').slice(0, 40);

  const rows = ledger.map((item) => ({
    date: formatReportDate(String(item.sortAt || item.date || item.createdAt || '')),
    description: String(item.label || item.type || item.title || '—'),
    shop: String(item.shopName || item.shop || '—'),
    amount:
      item.creditAmount != null
        ? formatRs(Number(item.creditAmount))
        : item.paymentAmount != null
          ? `-${formatRs(Number(item.paymentAmount))}`
          : formatRs(Number(item.amount || 0)),
  }));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${PDF_STYLES}</head><body>
    <h1>${escapeHtml(t('customer.statementTitle'))}${escapeHtml(titleSuffix)}</h1>
    <div class="meta">
      <p>${escapeHtml(options.fullName || '')}${options.email ? ` · ${escapeHtml(options.email)}` : ''}</p>
    </div>
    ${buildStatsTableHtml([
      [t('customer.currentDue'), formatRs(due)],
      [t('customer.totalPurchases'), formatRs(purchases)],
      [t('customer.totalPayments'), formatRs(paid)],
      [t('customer.linkedShops'), String(dashboard?.summary?.totalShops ?? dashboard?.shops?.length ?? 0)],
    ])}
    <h2>${escapeHtml(t('customer.recentTransactions'))}</h2>
    ${buildTableHtml(rows, [
      { label: t('pdf.colDate'), key: 'date' },
      { label: t('pdf.colDescription'), key: 'description' },
      { label: t('pdf.colShop'), key: 'shop' },
      { label: t('pdf.colAmount'), key: 'amount' },
    ])}
    <p class="footer">${escapeHtml(t('pdf.generated', { date: formatReportDate(new Date().toISOString()) }))}</p>
  </body></html>`;

  await shareHtmlAsPdf(html, t('customer.downloadStatement'), {
    fileName: `BakiBook_Statement_${safeName}_${stamp}`,
  });
}
