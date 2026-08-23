import { Navigate } from 'react-router-dom';
import ShopkeeperDashboard from '../components/shopkeeper/ShopkeeperDashboard';
import { getAuth, getPostAuthPath } from '../services/auth';

function Dashboard() {
  const auth = getAuth();
  const user = auth?.user;

  if (!auth || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === 'shopkeeper') {
    return <ShopkeeperDashboard user={user} />;
  }

  if (user.role === 'customer') {
    return <Navigate to={getPostAuthPath(user, user.pendingLinkCount)} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default Dashboard;
