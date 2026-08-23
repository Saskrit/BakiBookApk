import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import {
  getAuth,
  getPostAuthPath,
  resendRegistrationCode,
  saveAuth,
  verifyRegistration,
} from '../services/auth';
import AuthShell from '../components/AuthShell';
import './AuthPage.css';

function RegisterVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputs = useRef([]);
  const email = location.state?.email?.trim()?.toLowerCase() || '';
  const role = location.state?.role === 'customer' ? 'customer' : 'shopkeeper';
  const initialMessage = location.state?.message || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(initialMessage);

  const code = useMemo(() => digits.join(''), [digits]);
  const auth = getAuth();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (auth?.user) {
    return <Navigate to={getPostAuthPath(auth.user, auth.user.pendingLinkCount)} replace />;
  }

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  const applyDigits = (rawValue, startIndex) => {
    const pastedDigits = String(rawValue || '')
      .replace(/\D/g, '')
      .slice(0, 6 - startIndex);
    if (!pastedDigits) return;

    setDigits((current) => {
      const next = [...current];
      pastedDigits.split('').forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      return next;
    });

    const nextIndex = Math.min(startIndex + pastedDigits.length, 5);
    inputs.current[nextIndex]?.focus();
  };

  const handleDigitChange = (index, rawValue) => {
    const numericValue = String(rawValue || '').replace(/\D/g, '');
    if (numericValue.length > 1) {
      applyDigits(numericValue, index);
      return;
    }

    const digit = numericValue.slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await verifyRegistration({ email, role, code });
      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate(getPostAuthPath(data.user, data.pendingLinkCount), { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const data = await resendRegistrationCode({ email, role });
      setDigits(['', '', '', '', '', '']);
      setMessage(data.message || 'A new verification code was sent to your email.');
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Could not resend the code');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell backTo="/register" backLabel="Back to register">
      <div className="auth-page__card">
        <div className="auth-page__icon-wrap auth-page__icon-wrap--primary">
          <Mail size={28} />
        </div>

        <div className="auth-page__header">
          <h1>Enter verification code</h1>
          <p>
            We sent a 6-digit code to <strong>{email}</strong>. Enter it to finish creating
            your account.
          </p>
        </div>

        {error ? <p className="auth-page__message auth-page__message--error">{error}</p> : null}
        {message ? <p className="auth-page__message auth-page__message--success">{message}</p> : null}

        <form className="auth-page__form" onSubmit={handleVerify}>
          <div className="auth-page__code-row" role="group" aria-label="Verification code">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                className="auth-page__code-box"
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[index] && index > 0) {
                    inputs.current[index - 1]?.focus();
                  }
                }}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={index === 0 ? 6 : 1}
                autoFocus={index === 0}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <button type="submit" className="auth-page__submit" disabled={loading || resending}>
            {loading ? (
              <>
                <Loader2 size={16} className="auth-spinner" />
                Verifying...
              </>
            ) : (
              'Verify and continue'
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-page__resend"
          onClick={handleResend}
          disabled={loading || resending}
        >
          {resending ? 'Sending code...' : 'Resend code'}
        </button>

        <p className="auth-page__footer">
          Wrong email? <Link to="/register">Start over</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default RegisterVerify;
