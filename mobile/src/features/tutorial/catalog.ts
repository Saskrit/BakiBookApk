export type TutorialChapterId =
  | 'shop-setup'
  | 'dashboard'
  | 'customers'
  | 'credit'
  | 'ledger'
  | 'payments'
  | 'qr'
  | 'products'
  | 'expenses'
  | 'reports'
  | 'notifications'
  | 'security';

export type TutorialStep = {
  id: string;
  route?:
    | 'ShopProfile'
    | 'Dashboard'
    | 'Customers'
    | 'AddCredit'
    | 'AddCustomer'
    | 'Products'
    | 'Expenses'
    | 'Reports'
    | 'Notifications'
    | 'Security'
    | 'QRScanner';
};

export type TutorialChapter = {
  id: TutorialChapterId;
  steps: TutorialStep[];
};

/** Keep step IDs in sync with server/utils/tutorialCatalog.js */
export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: 'shop-setup',
    steps: [
      { id: 'shop-setup.open-profile', route: 'ShopProfile' },
      { id: 'shop-setup.enter-name', route: 'ShopProfile' },
      { id: 'shop-setup.add-location', route: 'ShopProfile' },
      { id: 'shop-setup.add-photo', route: 'ShopProfile' },
      { id: 'shop-setup.submit', route: 'ShopProfile' },
    ],
  },
  {
    id: 'dashboard',
    steps: [
      { id: 'dashboard.open', route: 'Dashboard' },
      { id: 'dashboard.read-stats', route: 'Dashboard' },
      { id: 'dashboard.use-quick-actions', route: 'Dashboard' },
      { id: 'dashboard.check-reminders', route: 'Dashboard' },
    ],
  },
  {
    id: 'customers',
    steps: [
      { id: 'customers.open-list', route: 'Customers' },
      { id: 'customers.add-customer', route: 'AddCustomer' },
      { id: 'customers.filter-tabs', route: 'Customers' },
      { id: 'customers.open-profile', route: 'Customers' },
    ],
  },
  {
    id: 'credit',
    steps: [
      { id: 'credit.open', route: 'AddCredit' },
      { id: 'credit.pick-customer', route: 'AddCredit' },
      { id: 'credit.add-items', route: 'AddCredit' },
      { id: 'credit.save', route: 'AddCredit' },
    ],
  },
  {
    id: 'ledger',
    steps: [
      { id: 'ledger.open-customer', route: 'Customers' },
      { id: 'ledger.review-balance', route: 'Customers' },
      { id: 'ledger.download-report', route: 'Customers' },
    ],
  },
  {
    id: 'payments',
    steps: [
      { id: 'payments.open-record', route: 'Customers' },
      { id: 'payments.enter-amount', route: 'Customers' },
      { id: 'payments.save', route: 'Customers' },
    ],
  },
  {
    id: 'qr',
    steps: [
      { id: 'qr.open-scanner', route: 'QRScanner' },
      { id: 'qr.scan-customer', route: 'QRScanner' },
    ],
  },
  {
    id: 'products',
    steps: [
      { id: 'products.open', route: 'Products' },
      { id: 'products.add-product', route: 'Products' },
      { id: 'products.search', route: 'Products' },
    ],
  },
  {
    id: 'expenses',
    steps: [
      { id: 'expenses.open', route: 'Expenses' },
      { id: 'expenses.add-expense', route: 'Expenses' },
      { id: 'expenses.filter-month', route: 'Expenses' },
    ],
  },
  {
    id: 'reports',
    steps: [
      { id: 'reports.open', route: 'Reports' },
      { id: 'reports.change-period', route: 'Reports' },
      { id: 'reports.export-pdf', route: 'Reports' },
    ],
  },
  {
    id: 'notifications',
    steps: [
      { id: 'notifications.open', route: 'Notifications' },
      { id: 'notifications.mark-read', route: 'Notifications' },
    ],
  },
  {
    id: 'security',
    steps: [
      { id: 'security.open', route: 'Security' },
      { id: 'security.review-email', route: 'Security' },
      { id: 'security.change-password', route: 'Security' },
    ],
  },
];

export const ALL_TUTORIAL_STEP_IDS = TUTORIAL_CHAPTERS.flatMap((c) => c.steps.map((s) => s.id));

export function getTutorialStats(completedStepIds: string[] = []) {
  const completed = new Set(completedStepIds.filter((id) => ALL_TUTORIAL_STEP_IDS.includes(id)));
  const total = ALL_TUTORIAL_STEP_IDS.length;
  const completedCount = completed.size;
  return {
    total,
    completedCount,
    percent: total ? Math.round((completedCount / total) * 100) : 0,
    completed,
  };
}

export function getChapterStats(chapterId: TutorialChapterId, completedStepIds: string[] = []) {
  const chapter = TUTORIAL_CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) return { total: 0, completedCount: 0, percent: 0, isComplete: false };
  const completed = new Set(completedStepIds);
  const completedCount = chapter.steps.filter((s) => completed.has(s.id)).length;
  const total = chapter.steps.length;
  return {
    total,
    completedCount,
    percent: total ? Math.round((completedCount / total) * 100) : 0,
    isComplete: completedCount === total && total > 0,
  };
}
