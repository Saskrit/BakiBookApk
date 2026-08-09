import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login';
import AdminLogin from '../pages/AdminLogin';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import AuthRedirect from '../pages/AuthRedirect';
import VerifyEmail from '../pages/VerifyEmail';
import VerifyEmailPending from '../pages/VerifyEmailPending';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import TermsConditions from '../pages/TermsConditions';
import LegalDataPolicy from '../pages/LegalDataPolicy';
import About from '../pages/About';
import Contact from '../pages/Contact';
import AdminLegal from '../pages/AdminLegal';
import {
  ProtectedRoute,
  ShopkeeperRoute,
  CustomerRoute,
  AdminRoute,
  GuestRoute,
} from '../components/routes/RouteGuards';
import {
  CustomerListPage,
  AddCustomerPage,
  CustomerDetailPage,
  EditCustomerPage,
} from '../pages/shopkeeper/CustomerPages';
import {
  AddCreditPage,
  TransactionListPage,
  TransactionDetailPage,
  EditTransactionPage,
  RecordPaymentPage,
  PaymentDetailPage,
} from '../pages/shopkeeper/TransactionPaymentPages';
import {
  CustomerLedgerPage,
  OutstandingDuesPage,
  OverdueCustomersPage,
  NotificationsCenterPage,
  NotificationDetailPage,
  DueRemindersPage,
  SendReminderPage,
} from '../pages/shopkeeper/LedgerNotificationPages';
import {
  ReportsDashboardPage,
  DailyReportPage,
  WeeklyReportPage,
  MonthlyReportPage,
  CustomerReportPage,
  OutstandingReportPage,
  CreditsReportPage,
  PaymentsReportPage,
  ProductsReportPage,
  ActivityReportPage,
  CompleteReportPage,
  DownloadReportPage,
  AnalyticsDashboardPage,
  CreditTrendsPage,
  PaymentTrendsPage,
  CustomerPerformancePage,
} from '../pages/shopkeeper/ReportAnalyticsPages';
import { ShopSettingsPage } from '../pages/shopkeeper/ShopSettingsPage';
import { ShopMessagesPage } from '../pages/shopkeeper/MessagesPage';
import { PaymentSubmissionsPage } from '../pages/shopkeeper/PaymentSubmissionsPage';
import { CustomerMessagesPage } from '../pages/customer/CustomerMessagesPage';
import {
  CustomerPortalDashboard,
  MyLedgerPage,
  MyTransactionsPage,
  MyPaymentsPage,
  MyDueBalancePage,
  MyNotificationsPage,
  MyProfilePage,
} from '../pages/customer/CustomerPortalPages';
import { LinkShopsPage, LinkShopDetailPage, MyLinkedShopsPage } from '../pages/customer/LinkShopsPage';
import { CustomerSharedAccountPage } from '../pages/shared/SharedAccountPage';
import { ShopkeeperSharedAccountPage } from '../pages/shared/SharedAccountPage';
import {
  AdminDashboardPage,
  AdminShopsPage,
  AdminUsersPage,
  AdminReportsPage,
  AdminAnalyticsPage,
  AdminSettingsPage,
} from '../pages/admin/AdminPages';
import { NotFoundPage, AccessDeniedPage, MaintenancePage } from '../pages/errors/ErrorPages';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/admin/login" element={<GuestRoute><AdminLogin /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-email" element={<ProtectedRoute><VerifyEmailPending /></ProtectedRoute>} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/terms" element={<TermsConditions />} />
      <Route path="/legal/data-policy" element={<LegalDataPolicy />} />
      <Route path="/auth/redirect" element={<ProtectedRoute><AuthRedirect /></ProtectedRoute>} />
      <Route path="/profile" element={<CustomerRoute><Navigate to="/portal/profile" replace /></CustomerRoute>} />
      <Route path="/profile/settings" element={<CustomerRoute><Navigate to="/portal/profile" replace /></CustomerRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* Shopkeeper routes */}
      <Route path="/shop/customers" element={<ShopkeeperRoute><CustomerListPage /></ShopkeeperRoute>} />
      <Route path="/shop/customers/new" element={<ShopkeeperRoute><AddCustomerPage /></ShopkeeperRoute>} />
      <Route path="/shop/customers/:id" element={<ShopkeeperRoute><CustomerDetailPage /></ShopkeeperRoute>} />
      <Route path="/shop/customers/:id/edit" element={<ShopkeeperRoute><EditCustomerPage /></ShopkeeperRoute>} />
      <Route path="/shop/customers/:id/account" element={<ShopkeeperRoute><ShopkeeperSharedAccountPage /></ShopkeeperRoute>} />
      <Route path="/shop/messages" element={<ShopkeeperRoute><ShopMessagesPage /></ShopkeeperRoute>} />
      <Route path="/shop/messages/:customerId" element={<ShopkeeperRoute><ShopMessagesPage /></ShopkeeperRoute>} />
      <Route path="/shop/credit/new" element={<ShopkeeperRoute><AddCreditPage /></ShopkeeperRoute>} />
      <Route path="/shop/transactions" element={<ShopkeeperRoute><TransactionListPage /></ShopkeeperRoute>} />
      <Route path="/shop/transactions/:id" element={<ShopkeeperRoute><TransactionDetailPage /></ShopkeeperRoute>} />
      <Route path="/shop/transactions/:id/edit" element={<ShopkeeperRoute><EditTransactionPage /></ShopkeeperRoute>} />
      <Route path="/shop/payments" element={<ShopkeeperRoute><Navigate to="/shop/transactions" replace /></ShopkeeperRoute>} />
      <Route path="/shop/payment-submissions" element={<ShopkeeperRoute><PaymentSubmissionsPage /></ShopkeeperRoute>} />
      <Route path="/shop/payments/new" element={<ShopkeeperRoute><RecordPaymentPage /></ShopkeeperRoute>} />
      <Route path="/shop/payments/:id" element={<ShopkeeperRoute><PaymentDetailPage /></ShopkeeperRoute>} />
      <Route path="/shop/ledger" element={<ShopkeeperRoute><CustomerLedgerPage /></ShopkeeperRoute>} />
      <Route path="/shop/ledger/:customerId" element={<ShopkeeperRoute><CustomerLedgerPage /></ShopkeeperRoute>} />
      <Route path="/shop/dues" element={<ShopkeeperRoute><OutstandingDuesPage /></ShopkeeperRoute>} />
      <Route path="/shop/overdue" element={<ShopkeeperRoute><OverdueCustomersPage /></ShopkeeperRoute>} />
      <Route path="/shop/notifications" element={<ShopkeeperRoute><NotificationsCenterPage /></ShopkeeperRoute>} />
      <Route path="/shop/notifications/:id" element={<ShopkeeperRoute><NotificationDetailPage /></ShopkeeperRoute>} />
      <Route path="/shop/reminders" element={<ShopkeeperRoute><DueRemindersPage /></ShopkeeperRoute>} />
      <Route path="/shop/reminders/send" element={<ShopkeeperRoute><SendReminderPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports" element={<ShopkeeperRoute><ReportsDashboardPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/daily" element={<ShopkeeperRoute><DailyReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/weekly" element={<ShopkeeperRoute><WeeklyReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/monthly" element={<ShopkeeperRoute><MonthlyReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/credits" element={<ShopkeeperRoute><CreditsReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/payments" element={<ShopkeeperRoute><PaymentsReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/products" element={<ShopkeeperRoute><ProductsReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/activity" element={<ShopkeeperRoute><ActivityReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/customer" element={<ShopkeeperRoute><CustomerReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/outstanding" element={<ShopkeeperRoute><OutstandingReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/complete" element={<ShopkeeperRoute><CompleteReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/reports/download" element={<ShopkeeperRoute><DownloadReportPage /></ShopkeeperRoute>} />
      <Route path="/shop/analytics" element={<ShopkeeperRoute><AnalyticsDashboardPage /></ShopkeeperRoute>} />
      <Route path="/shop/analytics/credit" element={<ShopkeeperRoute><CreditTrendsPage /></ShopkeeperRoute>} />
      <Route path="/shop/analytics/payments" element={<ShopkeeperRoute><PaymentTrendsPage /></ShopkeeperRoute>} />
      <Route path="/shop/analytics/customers" element={<ShopkeeperRoute><CustomerPerformancePage /></ShopkeeperRoute>} />
      <Route path="/shop/settings" element={<ShopkeeperRoute><ShopSettingsPage /></ShopkeeperRoute>} />
      <Route path="/shop/qr" element={<Navigate to="/shop/settings" replace />} />
      <Route path="/shop/qr/*" element={<Navigate to="/shop/settings" replace />} />
      <Route path="/shop/profile" element={<Navigate to="/shop/settings" replace />} />
      <Route path="/shop/profile/edit" element={<Navigate to="/shop/settings" replace />} />

      {/* Customer portal */}
      <Route path="/portal/link-shops" element={<CustomerRoute><LinkShopsPage /></CustomerRoute>} />
      <Route path="/portal/link-shops/:customerId" element={<CustomerRoute><LinkShopDetailPage /></CustomerRoute>} />
      <Route path="/portal/shops" element={<CustomerRoute><MyLinkedShopsPage /></CustomerRoute>} />
      <Route path="/portal/shops/:customerId" element={<CustomerRoute><CustomerSharedAccountPage /></CustomerRoute>} />
      <Route path="/portal/messages" element={<CustomerRoute><CustomerMessagesPage /></CustomerRoute>} />
      <Route path="/portal/messages/:customerId" element={<CustomerRoute><CustomerMessagesPage /></CustomerRoute>} />
      <Route path="/portal" element={<CustomerRoute><CustomerPortalDashboard /></CustomerRoute>} />
      <Route path="/portal/ledger" element={<CustomerRoute><MyLedgerPage /></CustomerRoute>} />
      <Route path="/portal/transactions" element={<CustomerRoute><MyTransactionsPage /></CustomerRoute>} />
      <Route path="/portal/payments" element={<CustomerRoute><MyPaymentsPage /></CustomerRoute>} />
      <Route path="/portal/dues" element={<CustomerRoute><MyDueBalancePage /></CustomerRoute>} />
      <Route path="/portal/notifications" element={<CustomerRoute><MyNotificationsPage /></CustomerRoute>} />
      <Route path="/portal/profile" element={<CustomerRoute><MyProfilePage /></CustomerRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
      <Route path="/admin/shops" element={<AdminRoute><AdminShopsPage /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsPage /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
      <Route path="/admin/legal" element={<AdminRoute><AdminLegal /></AdminRoute>} />

      {/* Errors */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
