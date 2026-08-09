import { fetchPortalDashboard, fetchPortalLedger } from '../api/portal';
import { formatRs } from './format';
import { escapeHtml, formatReportDate, PDF_STYLES, shareHtmlAsPdf } from './pdfHtml';
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

  const rows = ledger.map((item) => {
    const title = String(item.label || item.type || item.title || '—');
    const shop = String(item.shopName || item.shop || '—');
    const date = formatReportDate(String(item.sortAt || item.date || item.createdAt || ''));
    const amount =
      item.creditAmount != null
        ? formatRs(Number(item.creditAmount))
        : item.paymentAmount != null
          ? `-${formatRs(Number(item.paymentAmount))}`
          : formatRs(Number(item.amount || 0));
    return `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(title)}</td><td>${escapeHtml(shop)}</td><td style="text-align:right">${escapeHtml(amount)}</td></tr>`;
  });

  const titleSuffix = options.shopName ? ` · ${options.shopName}` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${PDF_STYLES}</head><body>
    <h1>${escapeHtml(t('customer.statementTitle'))}${escapeHtml(titleSuffix)}</h1>
    <p>${escapeHtml(options.fullName || '')} · ${escapeHtml(options.email || '')}</p>
    <p>${escapeHtml(t('customer.currentDue'))}: <strong>${escapeHtml(formatRs(due))}</strong></p>
    <p>${escapeHtml(t('customer.totalPurchases'))}: ${escapeHtml(formatRs(purchases))} · ${escapeHtml(t('customer.totalPayments'))}: ${escapeHtml(formatRs(paid))}</p>
    <table><thead><tr><th>${escapeHtml(t('pdf.colDate'))}</th><th>${escapeHtml(t('pdf.colDescription') || 'Description')}</th><th>${escapeHtml(t('pdf.colShop') || 'Shop')}</th><th>${escapeHtml(t('pdf.colAmount'))}</th></tr></thead>
    <tbody>${rows.join('') || `<tr><td colspan="4">${escapeHtml(t('customer.noLedger'))}</td></tr>`}</tbody></table>
    <p style="margin-top:16px;color:#64748B;font-size:12px">${escapeHtml(t('pdf.generated', { date: formatReportDate(new Date().toISOString()) }))}</p>
  </body></html>`;

  await shareHtmlAsPdf(html, t('customer.downloadStatement'));
}
