import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { appAlert } from '../contexts/DialogContext';
import i18n from '../i18n';
import { formatRs } from './format';

const SAF_DIR_KEY = 'bakibook_pdf_save_dir_v2';
const PRINT_SIZE = { width: 595, height: 842 };

export function escapeHtml(text: unknown) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localeTag() {
  return i18n.language === 'ne' ? 'ne-NP' : 'en-GB';
}

export function formatReportDate(iso?: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleDateString(localeTag(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
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

  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Avoid CSS grid — Android WebView print often blanks or fails with grid/minmax. */
export const PDF_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 20px; font-size: 11px; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  h2 {
    font-size: 12px;
    margin: 18px 0 8px;
    page-break-after: avoid;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
  }
  .meta { color: #555; margin-bottom: 16px; font-size: 11px; line-height: 1.55; }
  .stats { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
  .stats td {
    width: 50%;
    border: 1px solid #ddd;
    padding: 8px 10px;
    vertical-align: top;
  }
  .stats .label { display: block; font-size: 10px; color: #666; margin-bottom: 3px; }
  .stats .value { font-size: 13px; font-weight: 700; }
  .profile p { margin: 0 0 6px; font-size: 11px; line-height: 1.5; }
  table.data { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px; }
  table.data th, table.data td {
    border: 1px solid #ddd;
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }
  table.data th { background: #f5f3f0; font-size: 9px; text-transform: uppercase; }
  .empty { color: #666; font-style: italic; }
  .footer { margin-top: 18px; font-size: 10px; color: #777; }
`;

export function buildStatsTableHtml(items: Array<[string, string]>) {
  if (!items.length) return '';
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    rows.push(`<tr>
      <td><span class="label">${escapeHtml(left[0])}</span><span class="value">${escapeHtml(left[1])}</span></td>
      <td>${
        right
          ? `<span class="label">${escapeHtml(right[0])}</span><span class="value">${escapeHtml(right[1])}</span>`
          : ''
      }</td>
    </tr>`);
  }
  return `<table class="stats">${rows.join('')}</table>`;
}

function sanitizeFileName(name: string) {
  return (
    name
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'BakiBook_Report'
  );
}

function isUserCancelled(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /cancel|dismiss|did not share|sharing.*(cancel|abort)|permission/i.test(msg);
}

/** PDF files must start with the bytes %PDF */
function assertPdfBytes(bytes: Uint8Array) {
  if (
    bytes.length < 5 ||
    bytes[0] !== 0x25 || // %
    bytes[1] !== 0x50 || // P
    bytes[2] !== 0x44 || // D
    bytes[3] !== 0x46 // F
  ) {
    throw new Error(i18n.t('pdf.exportFailedBody'));
  }
}

async function sharePdfFile(uri: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(i18n.t('pdf.exportFailedBody'));
  }
  await Sharing.shareAsync(uri, {
    dialogTitle: title,
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}

async function openDownloadsFolder() {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.intent.action.VIEW_DOWNLOADS');
    return;
  } catch {
    /* try DocumentsUI Downloads next */
  }
  try {
    await Linking.openURL(
      'content://com.android.externalstorage.documents/document/primary%3ADownload'
    );
  } catch {
    /* user can open Files app manually */
  }
}

function showPdfReadyDialog(fileName: string, localUri: string, title: string) {
  appAlert(i18n.t('pdf.savedToDevice'), i18n.t('pdf.savedToDeviceBody', { name: `${fileName}.pdf` }), [
    {
      text: i18n.t('pdf.openNow'),
      onPress: () => {
        void sharePdfFile(localUri, title).catch(() => undefined);
      },
    },
    {
      text: i18n.t('pdf.viewDownloads'),
      onPress: () => {
        void openDownloadsFolder();
      },
    },
  ]);
}

async function getOrPickSaveDirectory(): Promise<Directory | null> {
  try {
    const saved = await AsyncStorage.getItem(SAF_DIR_KEY);
    if (saved) {
      const dir = new Directory(saved);
      if (dir.exists) return dir;
    }
  } catch {
    await AsyncStorage.removeItem(SAF_DIR_KEY).catch(() => undefined);
  }

  try {
    const dir = await Directory.pickDirectoryAsync();
    if (dir?.uri) {
      await AsyncStorage.setItem(SAF_DIR_KEY, dir.uri);
      return dir;
    }
  } catch (err) {
    if (isUserCancelled(err)) return null;
    throw err;
  }
  return null;
}

/**
 * Write raw PDF bytes into a user-chosen folder (Downloads etc.).
 * Uses Uint8Array — never base64 — so Android viewers can open the file.
 */
async function savePdfBytesToDevice(bytes: Uint8Array, fileName: string): Promise<boolean> {
  let dir = await getOrPickSaveDirectory();
  if (!dir) return false;

  const writeInto = (target: Directory) => {
    const dest = target.createFile(`${fileName}.pdf`, 'application/pdf');
    dest.write(bytes);
    const info = dest.info();
    if (!dest.exists || (info.size ?? 0) < 64) {
      throw new Error('PDF write produced an empty file');
    }
    // Re-read magic bytes from the saved file when possible
    try {
      assertPdfBytes(dest.bytesSync());
    } catch {
      // Some SAF providers can't re-read; size check above is enough
    }
  };

  try {
    writeInto(dir);
    return true;
  } catch {
    await AsyncStorage.removeItem(SAF_DIR_KEY).catch(() => undefined);
    dir = await getOrPickSaveDirectory();
    if (!dir) return false;
    writeInto(dir);
    return true;
  }
}

function copyPdfToAppDocuments(source: File, fileName: string): File {
  const dest = new File(Paths.document, `${fileName}.pdf`);
  if (dest.exists) {
    dest.delete();
  }
  source.copySync(dest);
  return dest;
}

/**
 * Generate a PDF from HTML and save it to the user's device as a real binary PDF.
 */
export async function shareHtmlAsPdf(
  html: string,
  dialogTitle?: string,
  options?: { fileName?: string }
) {
  const title = dialogTitle ?? i18n.t('pdf.exportTitle');
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = sanitizeFileName(options?.fileName || `BakiBook_Report_${stamp}`);

  const printed = await Print.printToFileAsync({
    html,
    width: PRINT_SIZE.width,
    height: PRINT_SIZE.height,
  });

  if (!printed?.uri) {
    throw new Error(i18n.t('pdf.exportFailedBody'));
  }

  const source = new File(printed.uri);
  if (!source.exists) {
    throw new Error(i18n.t('pdf.exportFailedBody'));
  }

  const bytes = await source.bytes();
  assertPdfBytes(bytes);

  // Keep a known-good binary copy inside the app documents folder.
  const localCopy = copyPdfToAppDocuments(source, fileName);

  if (Platform.OS === 'android') {
    try {
      const saved = await savePdfBytesToDevice(bytes, fileName);
      if (saved) {
        showPdfReadyDialog(fileName, localCopy.uri, title);
        return;
      }
    } catch {
      // Fall through to share sheet with the valid local copy
    }
  }

  try {
    showPdfReadyDialog(fileName, localCopy.uri, title);
  } catch (err) {
    if (isUserCancelled(err)) return;
    throw err instanceof Error ? err : new Error(i18n.t('pdf.exportFailedBody'));
  }
}

export { formatRs };
