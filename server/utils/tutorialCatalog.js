/** Stable tutorial step IDs — keep in sync with mobile/src/features/tutorial/catalog.ts */

export const TUTORIAL_STEP_IDS = [
  // Shop setup
  'shop-setup.open-profile',
  'shop-setup.enter-name',
  'shop-setup.add-location',
  'shop-setup.add-photo',
  'shop-setup.submit',
  // Dashboard
  'dashboard.open',
  'dashboard.read-stats',
  'dashboard.use-quick-actions',
  'dashboard.check-reminders',
  // Customers
  'customers.open-list',
  'customers.add-customer',
  'customers.filter-tabs',
  'customers.open-profile',
  // Credit
  'credit.open',
  'credit.pick-customer',
  'credit.add-items',
  'credit.save',
  // Customer ledger
  'ledger.open-customer',
  'ledger.review-balance',
  'ledger.download-report',
  // Payments
  'payments.open-record',
  'payments.enter-amount',
  'payments.save',
  // QR
  'qr.open-scanner',
  'qr.scan-customer',
  // Products
  'products.open',
  'products.add-product',
  'products.search',
  // Expenses
  'expenses.open',
  'expenses.add-expense',
  'expenses.filter-month',
  // Reports
  'reports.open',
  'reports.change-period',
  'reports.export-pdf',
  // Notifications
  'notifications.open',
  'notifications.mark-read',
  // Security
  'security.open',
  'security.review-email',
  'security.change-password',
];

export const TUTORIAL_STEP_ID_SET = new Set(TUTORIAL_STEP_IDS);

export function sanitizeTutorialStepIds(ids) {
  if (!Array.isArray(ids)) return [];
  const unique = new Set();
  for (const id of ids) {
    if (typeof id === 'string' && TUTORIAL_STEP_ID_SET.has(id)) {
      unique.add(id);
    }
  }
  return [...unique];
}

export function formatTutorialProgress(user) {
  const completedStepIds = sanitizeTutorialStepIds(user?.tutorialProgress?.completedStepIds || []);
  return {
    completedStepIds,
    updatedAt: user?.tutorialProgress?.updatedAt
      ? new Date(user.tutorialProgress.updatedAt).toISOString()
      : null,
    totalSteps: TUTORIAL_STEP_IDS.length,
    completedCount: completedStepIds.length,
    percent: TUTORIAL_STEP_IDS.length
      ? Math.round((completedStepIds.length / TUTORIAL_STEP_IDS.length) * 100)
      : 0,
  };
}
