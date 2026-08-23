import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { login, googleAuth, saveAuth, getAuth, getPostAuthPath, resendVerificationLink } from '../services/auth';
import { ApiError } from '../services/api';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AuthShell from '../components/AuthShell';
import './AuthPage.css';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendingLink, setResendingLink] = useState(false);
  const [showResendLink, setShowResendLink] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ identifier: '', password: '' });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const auth = getAuth();
    if (auth) {
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
    setShowResendLink(false);
  };

  const handleResendLink = async () => {
    const email = form.identifier.trim();
    if (!email || !form.password) {
      setError('Enter your email and password first.');
      return;
    }
    setResendingLink(true);
    setError('');
    try {
      const data = await resendVerificationLink(email, form.password);
      setError(data.message || 'Verification link sent. Check your email, then sign in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendingLink(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowResendLink(false);

    try {
      const data = await login({
        identifier: form.identifier.trim(),
        password: form.password,
      });

      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate(getPostAuthPath(data.user, data.pendingLinkCount), { replace: true });
    } catch (err) {
      const payload = err instanceof ApiError ? err.data : null;
      if (payload?.requiresVerification && (!payload.verificationMethod || payload.verificationMethod === 'link')) {
        setShowResendLink(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading || resendingLink;
  const googleLoginLock = useRef(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    if (googleLoginLock.current) return;
    googleLoginLock.current = true;

    setGoogleLoading(true);
    setError('');

    try {
      const data = await googleAuth({
        credential: credentialResponse.credential,
        mode: 'login',
      });

      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate(getPostAuthPath(data.user, data.pendingLinkCount), { replace: true });
    } catch (err) {
      setError(err.message);
      googleLoginLock.current = false;
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell backTo="/" backLabel="Home">
      <div className="auth-page__card login-card">
        <div className="login-card__header">
          <h1>Welcome back</h1>
          <p>Sign in to your BakiBook account</p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="auth-page__field">
            <label htmlFor="identifier">Email Address</label>
            <div className="auth-page__input-wrap">
              <Mail size={18} className="auth-page__input-icon" />
              <input
                id="identifier"
                type="email"
                name="identifier"
                placeholder="Enter your email address"
                value={form.identifier}
                onChange={handleChange}
                required
                disabled={isBusy}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-page__field">
            <label htmlFor="password">Password</label>
            <div className="auth-page__input-wrap">
              <Lock size={18} className="auth-page__input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                disabled={isBusy}
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

          <div className="login-form__forgot">
            <Link to="/forgot-password" className="login-form__link">
              Forgot Password?
            </Link>
          </div>

          <button type="submit" className="auth-page__submit" disabled={isBusy}>
            {loading ? (
              <>
                <Loader2 size={16} className="auth-spinner" />
                Logging in...
              </>
            ) : (
              <>
                Login
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {showResendLink ? (
            <button
              type="button"
              className="login-form__link"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
              }}
              onClick={handleResendLink}
              disabled={isBusy || resendingLink}
            >
              {resendingLink ? 'Sending verification link…' : 'Resend verification link'}
            </button>
          ) : null}
        </form>

        <div className="login-divider">
          <span>OR</span>
        </div>

        <GoogleAuthButton
          text="signin_with"
          disabled={isBusy}
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google sign-in was cancelled or failed. Please try again.')}
        />

        <p className="auth-page__footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Sign up here</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default Login;
