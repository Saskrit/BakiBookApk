import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Check,
  X,
  Store,
  Users,
  Wallet,
  ArrowLeftRight,
  ChevronRight,
  BarChart3,
  FileText,
  Info,
} from 'lucide-react';
import { getAuth, getPostAuthPath } from '../../services/auth';
import AdminLayout from '../../components/layouts/AdminLayout';
import PageHeader from '../../components/app/PageHeader';
import DataTable from '../../components/app/DataTable';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import {
  fetchAdminDashboard,
  fetchAdminShops,
  fetchAdminUsers,
  fetchAdminAnalytics,
  verifyAdminShop,
  rejectAdminShop,
  fetchMaintenanceSettings,
  updateMaintenanceSettings,
} from '../../services/admin';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { formatRs } from '../../utils/format';
import '../../components/app/AppPages.css';
import './AdminPages.css';
import './AdminAnalytics.css';
import {
  AdminTrendChart,
  AdminBarChart,
  AdminDonutChart,
  AdminTopShopsList,
} from './AdminAnalyticsCharts';

function useAdminUser() {
  return getAuth()?.user;
}

function AdminShell({ children, pageTitle, pageSubtitle }) {
  const user = useAdminUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) {
    return <Navigate to={getPostAuthPath(user, user.pendingLinkCount)} replace />;
  }
  return (
    <AdminLayout user={user} pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
      {children}
    </AdminLayout>
  );
}

function statusBadge(status) {
  if (status === 'verified') return 'app-badge--success';
  if (status === 'pending') return 'app-badge--warn';
  if (status === 'rejected') return 'app-badge--danger';
  return 'app-badge--muted';
}

function roleBadge(role) {
  if (role === 'admin') return 'admin-role-badge admin-role-badge--admin';
  if (role === 'shopkeeper') return 'admin-role-badge admin-role-badge--shopkeeper';
  return 'admin-role-badge admin-role-badge--customer';
}

export function AdminDashboardPage() {
  const { data, loading, error, reload } = useApi(() => fetchAdminDashboard(), []);
  const stats = data?.stats;

  return (
    <AdminShell pageTitle="Dashboard" pageSubtitle="Platform overview and quick actions">
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--shops">
                <Store size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Total Shops</span>
                <strong>{stats?.totalShops ?? 0}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--users">
                <Users size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Total Users</span>
                <strong>{stats?.activeUsers ?? 0}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--credit">
                <Wallet size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Credit Managed</span>
                <strong>{formatRs(stats?.creditManaged ?? 0)}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--tx">
                <ArrowLeftRight size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Transactions Today</span>
                <strong>{stats?.transactionsToday ?? 0}</strong>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__head">
              <div>
                <h3>Quick Actions</h3>
                <p>Jump to common admin tasks</p>
              </div>
            </div>
            <div className="admin-quick-grid">
              <Link to="/admin/shops" className="admin-quick-link">
                <Store size={20} />
                <div>
                  <strong>Review Shops</strong>
                  <span>Verify or reject pending submissions</span>
                </div>
              </Link>
              <Link to="/admin/users" className="admin-quick-link">
                <Users size={20} />
                <div>
                  <strong>Manage Users</strong>
                  <span>View all platform accounts</span>
                </div>
              </Link>
              <Link to="/admin/legal" className="admin-quick-link">
                <FileText size={20} />
                <div>
                  <strong>Edit Legal Content</strong>
                  <span>Update terms and privacy policy</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__head">
              <div>
                <h3>Platform Summary</h3>
                <p>Live metrics from the database</p>
              </div>
            </div>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--admin-text-muted, var(--color-text-muted))', lineHeight: 1.6 }}>
              BakiBook is managing {stats?.totalShops ?? 0} shop{stats?.totalShops !== 1 ? 's' : ''} with{' '}
              {stats?.activeUsers ?? 0} registered user{stats?.activeUsers !== 1 ? 's' : ''}.
              {stats?.customerAccounts != null && (
                <> {stats.customerAccounts} customer account{stats.customerAccounts !== 1 ? 's' : ''} active.</>
              )}
              {' '}Total credit tracked: {formatRs(stats?.creditManaged ?? 0)}.
            </p>
          </div>
        </>
      )}
    </AdminShell>
  );
}

export function AdminShopsPage() {
  const { data, loading, error, reload } = useApi(() => fetchAdminShops(), []);
  const shops = data?.shops || [];
  const [actingId, setActingId] = useState('');
  const { alert, prompt } = useAppDialog();

  const pendingCount = shops.filter((s) => s.status === 'pending').length;

  const handleVerify = async (shopId) => {
    setActingId(shopId);
    try {
      await verifyAdminShop(shopId);
      reload();
    } catch (err) {
      await alert({ title: 'Verification failed', message: err.message, variant: 'error' });
    } finally {
      setActingId('');
    }
  };

  const handleReject = async (shopId) => {
    const reason = await prompt({
      title: 'Reject shop',
      message: 'Optional reason for rejection:',
      placeholder: 'Enter reason (optional)',
      confirmLabel: 'Reject shop',
      cancelLabel: 'Cancel',
    });
    if (reason === null) return;
    setActingId(shopId);
    try {
      await rejectAdminShop(shopId, reason);
      reload();
    } catch (err) {
      await alert({ title: 'Rejection failed', message: err.message, variant: 'error' });
    } finally {
      setActingId('');
    }
  };

  return (
    <AdminShell pageTitle="Shop Management" pageSubtitle="Review and verify shopkeeper submissions">
      <PageHeader
        title="Registered Shops"
        subtitle={pendingCount > 0 ? `${pendingCount} shop${pendingCount !== 1 ? 's' : ''} awaiting review` : 'All shops reviewed'}
      />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable columns={[
          { key: 'name', label: 'Shop' },
          { key: 'owner', label: 'Owner' },
          { key: 'location', label: 'Location', render: (r) => r.location || '—' },
          { key: 'customers', label: 'Customers' },
          { key: 'outstanding', label: 'Outstanding', render: (r) => formatRs(r.outstanding) },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <span className={`app-badge ${statusBadge(r.status)}`}>{r.status}</span>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              r.status === 'pending' ? (
                <div className="app-table-actions">
                  <button
                    type="button"
                    className="admin-action-btn admin-action-btn--verify"
                    disabled={actingId === r.id}
                    onClick={() => handleVerify(r.id)}
                  >
                    <Check size={14} /> Verify
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn admin-action-btn--reject"
                    disabled={actingId === r.id}
                    onClick={() => handleReject(r.id)}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <span style={{ color: 'var(--admin-text-muted, var(--color-text-muted))', fontSize: 'var(--font-xs)' }}>—</span>
              )
            ),
          },
        ]} rows={shops} />
      )}
    </AdminShell>
  );
}

export function AdminUsersPage() {
  const { data, loading, error, reload } = useApi(() => fetchAdminUsers(), []);
  const users = data?.users || [];

  return (
    <AdminShell pageTitle="User Management" pageSubtitle="All registered platform accounts">
      <PageHeader title="Platform Users" subtitle={`${users.length} total user${users.length !== 1 ? 's' : ''}`} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <DataTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          {
            key: 'role',
            label: 'Role',
            render: (r) => (
              <span className={roleBadge(r.role)}>{r.role}</span>
            ),
          },
          { key: 'shop', label: 'Shop', render: (r) => r.shop || '—' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <span className={`app-badge ${r.status === 'active' ? 'app-badge--success' : 'app-badge--muted'}`}>
                {r.status || 'active'}
              </span>
            ),
          },
        ]} rows={users} />
      )}
    </AdminShell>
  );
}

export function AdminReportsPage() {
  return (
    <AdminShell pageTitle="Reports" pageSubtitle="Platform summaries and exports">
      <PageHeader title="Platform Reports" subtitle="Access detailed shop and user summaries" />
      <div className="admin-report-grid">
        <Link to="/admin/shops" className="admin-report-card">
          <div className="admin-report-card__icon">
            <Store size={22} />
          </div>
          <strong>Shops Summary</strong>
          <span>View all registered shops, verification status, and outstanding balances.</span>
          <span className="admin-report-card__cta">
            Open report <ChevronRight size={14} />
          </span>
        </Link>
        <Link to="/admin/users" className="admin-report-card">
          <div className="admin-report-card__icon">
            <Users size={22} />
          </div>
          <strong>User Activity</strong>
          <span>Browse all registered users, roles, and account statuses.</span>
          <span className="admin-report-card__cta">
            Open report <ChevronRight size={14} />
          </span>
        </Link>
        <Link to="/admin/analytics" className="admin-report-card">
          <div className="admin-report-card__icon">
            <BarChart3 size={22} />
          </div>
          <strong>Platform Analytics</strong>
          <span>Overview of platform growth and transaction activity.</span>
          <span className="admin-report-card__cta">
            View analytics <ChevronRight size={14} />
          </span>
        </Link>
      </div>
    </AdminShell>
  );
}

export function AdminAnalyticsPage() {
  const { data, loading, error, reload } = useApi(() => fetchAdminAnalytics(), []);
  const analytics = data?.analytics;
  const summary = analytics?.summary;

  return (
    <AdminShell pageTitle="Analytics" pageSubtitle="Platform growth and activity metrics">
      <PageHeader title="Platform Analytics" subtitle="Charts and trends across the last 6 months" />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--shops">
                <Store size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Total Shops</span>
                <strong>{summary?.totalShops ?? 0}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--users">
                <Users size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Customer Accounts</span>
                <strong>{summary?.customerAccounts ?? 0}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--credit">
                <Wallet size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Total Credit</span>
                <strong>{formatRs(summary?.creditManaged ?? 0)}</strong>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-card__icon admin-stat-card__icon--tx">
                <ArrowLeftRight size={20} />
              </div>
              <div className="admin-stat-card__body">
                <span>Payments Collected</span>
                <strong>{formatRs(summary?.paymentsCollected ?? 0)}</strong>
              </div>
            </div>
          </div>

          <div className="admin-analytics-grid admin-analytics-grid--wide">
            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>Credit vs Payments</h3>
                <p>Monthly credit issued and payments collected platform-wide</p>
              </div>
              <AdminTrendChart
                credit={analytics?.creditTrend}
                payment={analytics?.paymentTrend}
                labels={analytics?.monthLabels}
              />
            </section>

            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>Shop Verification</h3>
                <p>Breakdown of shop registration status</p>
              </div>
              <AdminDonutChart
                segments={analytics?.shopVerification}
                centerLabel="Shops"
                centerValue={summary?.totalShops}
              />
            </section>
          </div>

          <div className="admin-analytics-grid">
            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>Transaction Volume</h3>
                <p>Number of credit transactions per month</p>
              </div>
              <AdminBarChart
                data={analytics?.transactionTrend}
                labels={analytics?.monthLabels}
                color="#6B5A7A"
              />
            </section>

            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>User Growth</h3>
                <p>New user registrations per month</p>
              </div>
              <AdminBarChart
                data={analytics?.userGrowth}
                labels={analytics?.monthLabels}
                color="#4A6670"
              />
            </section>
          </div>

          <div className="admin-analytics-grid admin-analytics-grid--wide">
            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>Top Shops by Outstanding</h3>
                <p>Shops with the highest customer due balances</p>
              </div>
              <AdminTopShopsList shops={analytics?.topShops} />
            </section>

            <section className="admin-chart-card">
              <div className="admin-chart-card__head">
                <h3>User Roles</h3>
                <p>Platform account distribution</p>
              </div>
              <AdminDonutChart
                segments={analytics?.userRoles}
                centerLabel="Users"
                centerValue={summary?.activeUsers}
              />
              <div className="admin-chart-summary" style={{ marginTop: 16 }}>
                <div>
                  <span>Total transactions</span>
                  <strong>{summary?.totalTransactions ?? 0}</strong>
                </div>
                <div>
                  <span>Transactions today</span>
                  <strong>{summary?.transactionsToday ?? 0}</strong>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </AdminShell>
  );
}

export function AdminSettingsPage() {
  const { data, loading, error, reload } = useApi(() => fetchMaintenanceSettings(), []);
  const { alert, confirm } = useAppDialog();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const settings = data?.settings;
  const maintenanceOn = Boolean(settings?.maintenanceMode);

  useEffect(() => {
    if (settings?.maintenanceMessage) {
      setMessage(settings.maintenanceMessage);
    }
  }, [settings?.maintenanceMessage]);

  const handleToggle = async () => {
    const next = !maintenanceOn;
    const ok = await confirm({
      title: next ? 'Enable maintenance mode?' : 'Disable maintenance mode?',
      message: next
        ? 'Normal users will be blocked from using BakiBook. Admin access will remain available.'
        : 'Users will be able to use BakiBook again immediately.',
      confirmLabel: next ? 'Turn on' : 'Turn off',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await updateMaintenanceSettings({
        maintenanceMode: next,
        maintenanceMessage: message.trim() || undefined,
      });
      reload();
      await alert({
        title: 'Maintenance updated',
        message: next ? 'Maintenance mode is now on.' : 'Maintenance mode is now off.',
        variant: 'success',
      });
    } catch (err) {
      await alert({
        title: 'Update failed',
        message: err.message || 'Could not update maintenance mode',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell pageTitle="Settings" pageSubtitle="Platform configuration">
      <PageHeader
        title="System Settings"
        subtitle="Control platform availability and maintenance"
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="app-card">
          <div className="admin-settings-grid">
            <div className="app-field">
              <label>Platform name</label>
              <input defaultValue="BakiBook" readOnly />
            </div>
            <div className="app-field">
              <label>Support email</label>
              <input defaultValue="support@bakibook.com" readOnly />
            </div>
          </div>

          <div className="admin-maintenance-card">
            <div className="admin-maintenance-card__head">
              <div>
                <h3>Maintenance Mode</h3>
                <p>
                  When enabled, shopkeepers and customers cannot use the app. Admin accounts
                  stay fully accessible.
                </p>
              </div>
              <span
                className={`app-badge ${
                  maintenanceOn ? 'app-badge--warn' : 'app-badge--success'
                }`}
              >
                {maintenanceOn ? 'ON' : 'OFF'}
              </span>
            </div>

            <div className="app-field">
              <label htmlFor="maintenance-message">Maintenance message</label>
              <textarea
                id="maintenance-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="BakiBook is temporarily unavailable. Please check back soon."
              />
            </div>

            <button
              type="button"
              className={`admin-action-btn ${
                maintenanceOn ? 'admin-action-btn--reject' : 'admin-action-btn--verify'
              }`}
              onClick={handleToggle}
              disabled={saving}
            >
              {saving
                ? 'Updating...'
                : maintenanceOn
                  ? 'Turn maintenance off'
                  : 'Turn maintenance on'}
            </button>

            <div className="admin-settings-note">
              <Info size={16} />
              <span>
                Last updated:{' '}
                {settings?.updatedAt
                  ? new Date(settings.updatedAt).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
