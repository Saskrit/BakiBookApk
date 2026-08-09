import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Shield } from 'lucide-react';
import { getAuth, getPostAuthPath, login, saveAuth } from '../services/auth';
import AuthShell from '../components/AuthShell';
import './AuthPage.css';
import './Login.css';

function AdminLogin() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ identifier: '', password: '' });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const auth = getAuth();
    if (auth?.user?.isAdmin) {
      navigate('/admin', { replace: true });
    } else if (auth?.user) {
      navigate(getPostAuthPath(auth.user, auth.user?.pendingLinkCount), { replace: true });
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await login({
        identifier: form.identifier.trim(),
        password: form.password,
      });

      if (!data.user?.isAdmin) {
        setError('This account does not have admin access.');
        return;
      }

      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell backTo="/" backLabel="Home">
      <div className="auth-page__card login-card">
        <div className="login-card__header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Shield size={28} color="var(--color-primary, #6A7E3F)" />
          </div>
          <h1>Admin Login</h1>
          <p>Sign in with your admin credentials to manage BakiBook</p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="auth-page__field">
            <label htmlFor="admin-identifier">Admin Email</label>
            <div className="auth-page__input-wrap">
              <Mail size={18} className="auth-page__input-icon" />
              <input
                id="admin-identifier"
                type="email"
                name="identifier"
                placeholder="Enter admin email"
                value={form.identifier}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-page__field">
            <label htmlFor="admin-password">Password</label>
            <div className="auth-page__input-wrap">
              <Lock size={18} className="auth-page__input-icon" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter admin password"
                value={form.password}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-page__toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-page__submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="auth-spinner" />
                Signing in...
              </>
            ) : (
              <>
                Enter Admin
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="auth-page__footer">
          Not an admin? <Link to="/login">User login</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default AdminLogin;
