import i18n from '../i18n';

/** Parse amounts that may already include currency symbols or grouping. */
export const parseMoneyAmount = (value: number | string | undefined): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null || value === '') return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Western digits + NPR grouping (Nepali Rupee — never INR ₹ / Hindi digits). */
function formatNprAmount(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  // Force Latin digits and standard thousand separators used on NPR receipts.
  return `${sign}${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Nepali Rupee (NPR) — always NPR prefix with Western digits; never Indian ₹ */
export const formatRs = (amount: number | string | undefined) => {
  return `NPR ${formatNprAmount(parseMoneyAmount(amount))}`;
};

export const isNewAccount = (createdAt?: string, withinHours = 48) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < withinHours * 60 * 60 * 1000;
};

export const formatDate = (value?: string | Date) => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  // en-GB keeps Latin month names; Nepali UI still gets translated labels elsewhere.
  return date.toLocaleDateString(i18n.language === 'ne' ? 'en-GB' : 'en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const formatRelativeTime = (value?: string | Date) => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return i18n.t('common.justNow');
  if (diffMins < 60) return i18n.t('common.minAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return i18n.t('common.hourAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return i18n.t('common.yesterday');
  if (diffDays < 7) return i18n.t('common.daysAgo', { count: diffDays });
  return formatDate(date);
};

export const trendPercent = (current: number, previous: number) => {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

export const sumSlice = (values: number[], start: number, end: number) =>
  values.slice(start, end).reduce((total, value) => total + value, 0);

export const AVATAR_COLORS = ['#6A7E3F', '#3B82F6', '#C08552', '#8B5CF6', '#0891B2', '#C45C5C'];

export const avatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

export const formatLastTransaction = (creditDate?: string, paymentDate?: string) => {
  const credit = creditDate ? new Date(creditDate).getTime() : 0;
  const payment = paymentDate ? new Date(paymentDate).getTime() : 0;
  const latest = Math.max(credit, payment);
  if (!latest) return i18n.t('common.noActivity');

  const date = new Date(latest);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffDays === 0) return `${i18n.t('common.today')}, ${time}`;
  if (diffDays === 1) return `${i18n.t('common.yesterday')}, ${time}`;

  const dateLabel = date.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${dateLabel}, ${time}`;
};

export const getTransactionBadge = (
  balance: number,
  creditDate?: string,
  paymentDate?: string
): { label: string; tone: 'paid' | 'credit' } => {
  if (balance <= 0) return { label: i18n.t('common.paid'), tone: 'paid' };
  const credit = creditDate ? new Date(creditDate).getTime() : 0;
  const payment = paymentDate ? new Date(paymentDate).getTime() : 0;
  if (payment > credit) return { label: i18n.t('common.paid'), tone: 'paid' };
  return { label: i18n.t('common.newCredit'), tone: 'credit' };
};

export const isOverdueCustomer = (
  balance: number,
  creditDate?: string,
  overdueDays = 30
) => {
  if (balance <= 0) return false;
  const ref = creditDate ? new Date(creditDate).getTime() : 0;
  if (!ref) return false;
  const days = Math.floor((Date.now() - ref) / (1000 * 60 * 60 * 24));
  return days >= overdueDays;
};
