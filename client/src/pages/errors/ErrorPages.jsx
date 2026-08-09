import { Link } from 'react-router-dom';
import { Home, ShieldX, Wrench } from 'lucide-react';
import { getAuth, getPostAuthPath } from '../../services/auth';
import '../../components/app/AppPages.css';
import './ErrorPages.css';

function RoleHomeLink({ children, className }) {
  const auth = getAuth();
  const to = auth?.user ? getPostAuthPath(auth.user, auth.user.pendingLinkCount) : '/login';
  const label = auth?.user?.isAdmin
    ? 'Back to Admin'
    : auth?.user?.role === 'shopkeeper'
      ? 'Back to Dashboard'
      : auth?.user?.role === 'customer'
        ? 'Back to Portal'
        : 'Go to Login';

  return (
    <Link to={to} className={className}>
      {children || label}
    </Link>
  );
}

export function NotFoundPage() {
  return (
    <div className="error-page">
      <div className="error-page__card">
        <span className="error-page__code">404</span>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <Link to="/" className="app-btn app-btn--primary"><Home size={16} /> Go Home</Link>
      </div>
    </div>
  );
}

export function AccessDeniedPage() {
  return (
    <div className="error-page">
      <div className="error-page__card">
        <ShieldX size={48} className="error-page__icon" />
        <h1>Access Denied</h1>
        <p>You don&apos;t have permission to view this page.</p>
        <RoleHomeLink className="app-btn app-btn--primary" />
      </div>
    </div>
  );
}

export function MaintenancePage() {
  const auth = getAuth();
  const message =
    'BakiBook is temporarily unavailable. Please check back soon.';

  return (
    <div className="error-page">
      <div className="error-page__card">
        <Wrench size={48} className="error-page__icon" />
        <h1>Under Maintenance</h1>
        <p>{message}</p>
        {auth?.user?.isAdmin ? (
          <Link to="/admin" className="app-btn app-btn--primary">
            Back to Admin
          </Link>
        ) : (
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => window.location.assign('/')}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
