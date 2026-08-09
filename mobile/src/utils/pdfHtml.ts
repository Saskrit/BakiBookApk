import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { appAlert } from '../contexts/DialogContext';
import i18n from '../i18n';
import { formatRs } from './format';

export function escapeHtml(text: unknown) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localeTag() {
  return i18n.language === 'ne' ? 'ne-NP' : 'en-NP';
}

export function formatReportDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Column<T> = {
  label: string;
  key: keyof T | string;
  format?: (value: unknown, row: T) => string;
};

export function buildTableHtml<T extends Record<string, unknown>>(
  rows: T[] | undefined,
  columns: Column<T>[]
) {
  if (!rows?.length) {
    return `<p class="empty">${escapeHtml(i18n.t('pdf.noRecords'))}</p>`;
  }

  const head = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((col) => {
            const raw = row[col.key as string];
            const value = col.format ? col.format(raw, row) : raw;
            return `<td>${escapeHtml(value)}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export const PDF_STYLES = `
  body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 20px 0 8px; page-break-after: avoid; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { color: #555; margin-bottom: 20px; font-size: 11px; line-height: 1.6; }
  .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
  .stat span { display: block; font-size: 10px; color: #666; margin-bottom: 4px; }
  .stat strong { font-size: 14px; }
  .profile p { margin: 0 0 6px; font-size: 11px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f3f0; font-size: 10px; text-transform: uppercase; }
  .empty { color: #666; font-style: italic; }
  .footer { margin-top: 20px; font-size: 10px; color: #777; }
`;

export async function shareHtmlAsPdf(html: string, dialogTitle?: string) {
  const title = dialogTitle ?? i18n.t('pdf.exportTitle');
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { dialogTitle: title, mimeType: 'application/pdf' });
  } else {
    appAlert(i18n.t('pdf.saved'), file.uri);
  }
}

export { formatRs };
