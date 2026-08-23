import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Store,
  User,
  UserCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Loader2,
} from 'lucide-react';
import { register, googleAuth, saveAuth, getAuth, getPostAuthPath } from '../services/auth';
import GoogleAuthButton from '../components/GoogleAuthButton';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import './Register.css';

const CUSTOMER_STEPS = [
  { id: 1, label: 'Role', title: 'Choose Your Role', subtitle: 'Tell us how you will use BakiBook' },
  { id: 2, label: 'Details', title: 'Your Details', subtitle: 'Basic information to set up your account' },
  { id: 3, label: 'Security', title: 'Secure Your Account', subtitle: 'Create a strong password for your account' },
];

const SHOPKEEPER_STEPS = [
  { id: 1, label: 'Role', title: 'Choose Your Role', subtitle: 'Tell us how you will use BakiBook' },
  { id: 2, label: 'Details', title: 'Your Details', subtitle: 'Basic information to set up your account' },
  { id: 3, label: 'Security', title: 'Secure Your Account', subtitle: 'Create a strong password for your account' },
];

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('shopkeeper');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    profileImage: '',
    password: '',
    confirmPassword: '',
  });

  const steps = role === 'shopkeeper' ? SHOPKEEPER_STEPS : CUSTOMER_STEPS;
  const currentStep = steps[step - 1];
  const progress = (step / steps.length) * 100;
  const isLastStep = step === steps.length;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (getAuth()) {
      const auth = getAuth();
      navigate(getPostAuthPath(auth.user, auth.user?.pendingLinkCount), { replace: true });
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [navigate]);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    updateField(name, value);
  };

  const validateStep = (currentStepIndex) => {
    const stepDef = steps[currentStepIndex - 1];
    if (!stepDef) return true;

    if (stepDef.label === 'Role') {
      if (!agreed) return 'Please accept the Terms & Conditions';
      return true;
    }

    if (stepDef.label === 'Details') {
      if (!form.fullName.trim()) return 'Please enter your full name';
      if (!form.email.trim()) return 'Please enter your email address';
      return true;
    }

    if (stepDef.label === 'Security') {
      if (form.password.length < 6) return 'Password must be at least 6 characters';
      if (form.password !== form.confirmPassword) return 'Passwords do not match';
      return true;
    }

    return true;
  };

  const isBusy = loading || googleLoading;
  const googleSignupLock = useRef(false);

  const handleGoogleSignup = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google sign-up failed. Please try again.');
      return;
    }

    if (!agreed) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    if (googleSignupLock.current) return;
    googleSignupLock.current = true;

    setGoogleLoading(true);
    setError('');

    try {
      const data = await googleAuth({
        credential: credentialResponse.credential,
        role,
        mode: 'register',
        profileImage: form.profileImage || undefined,
      });

      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate(getPostAuthPath(data.user, data.pendingLinkCount), { replace: true });
    } catch (err) {
      setError(err.message);
      googleSignupLock.current = false;
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleNext = () => {
    const result = validateStep(step);
    if (result !== true) {
      setError(result);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, steps.length));
  };

  const handleBack = () => {
    setError('');
    if (step === 1) return;
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    const result = validateStep(steps.length);
    if (result !== true) {
      setError(result);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await register({
        role,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        profileImage: form.profileImage,
        password: form.password,
      });

      if (data.requiresVerification || !data.token || !data.user) {
        navigate('/register/verify', {
          replace: true,
          state: {
            email: data.email || form.email.trim().toLowerCase(),
            role: data.role || role,
            message: data.message,
          },
        });
        return;
      }

      saveAuth(data.token, data.user, data.pendingLinkCount);
      navigate(getPostAuthPath(data.user, data.pendingLinkCount), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-wizard">
      <aside className="register-wizard__aside">
        <Link to="/" className="register-wizard__brand">
          <BookOpen size={28} />
          <span>BakiBook</span>
        </Link>

        <div className="register-wizard__intro">
          <h1>Create Your Account</h1>
          <p>Join thousands of shopkeepers using BakiBook</p>
        </div>

        <ol className="register-wizard__steps">
          {steps.map((s, index) => (
            <li
              key={s.label}
              className={`register-wizard__step-item ${
                step === index + 1 ? 'register-wizard__step-item--active' : ''
              } ${step > index + 1 ? 'register-wizard__step-item--done' : ''}`}
            >
              <span className="register-wizard__step-num">
                {step > index + 1 ? <Check size={14} /> : index + 1}
              </span>
              <div>
                <strong>{s.label}</strong>
                <span>{s.title}</span>
              </div>
            </li>
          ))}
        </ol>

        <p className="register-wizard__aside-footer">
          Already have an account?{' '}
          <Link to="/login">Login here</Link>
        </p>
      </aside>

      <main className="register-wizard__main">
        <div className="register-wizard__topbar">
          <Link to="/" className="register-wizard__back">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <span className="register-wizard__step-count">
            Step {step} of {steps.length}
          </span>
        </div>

        <div className="register-wizard__progress">
          <div className="register-wizard__progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="register-wizard__content">
          <div className="register-wizard__step-header">
            <h2>{currentStep.title}</h2>
            <p>{currentStep.subtitle}</p>
          </div>

          {error && <p className="register-wizard__error">{error}</p>}

          <form className="register-wizard__form" onSubmit={(e) => e.preventDefault()}>
            {currentStep.label === 'Role' && (
              <div className="register-wizard__panel">
                <p className="register-role-label">I am a</p>
                <div className="register-role-cards">
                  <button
                    type="button"
                    className={`register-role-card ${role === 'shopkeeper' ? 'register-role-card--active' : ''}`}
                    onClick={() => setRole('shopkeeper')}
                  >
                    <Store size={28} />
                    <span>Shopkeeper</span>
                    <small>Manage credit & customers</small>
                  </button>
                  <button
                    type="button"
                    className={`register-role-card ${role === 'customer' ? 'register-role-card--active' : ''}`}
                    onClick={() => setRole('customer')}
                  >
                    <User size={28} />
                    <span>Customer</span>
                    <small>View dues & payments</small>
                  </button>
                </div>

                <label className="register-form__terms">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      setError('');
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer">
                      Terms &amp; Conditions
                    </Link>{' '}
                    and{' '}
                    <Link to="/legal/data-policy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
              </div>
            )}

            {currentStep.label === 'Details' && (
              <div className="register-wizard__panel">
                <GoogleAuthButton
                  text="signup_with"
                  disabled={isBusy}
                  onSuccess={handleGoogleSignup}
                  onError={() => setError('Google sign-up was cancelled or failed. Please try again.')}
                />

                <div className="register-divider">
                  <span>OR</span>
                </div>

                <ProfilePicturePicker
                  value={form.profileImage}
                  onChange={(value) => updateField('profileImage', value)}
                  onError={setError}
                  disabled={isBusy}
                  label="Profile Picture"
                  name={form.fullName}
                />

                <div className="register-form__group">
                  <label htmlFor="fullName">Full Name</label>
                  <div className="register-form__input-wrap">
                    <UserCircle size={18} className="register-form__icon" />
                    <input
                      id="fullName"
                      type="text"
                      name="fullName"
                      placeholder="Enter your full name"
                      value={form.fullName}
                      onChange={handleChange}
                      disabled={isBusy}
                    />
                  </div>
                </div>

                <div className="register-form__group">
                  <label htmlFor="email">Email Address</label>
                  <div className="register-form__input-wrap">
                    <Mail size={18} className="register-form__icon" />
                    <input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="Enter your email address"
                      value={form.email}
                      onChange={handleChange}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep.label === 'Security' && (
              <div className="register-wizard__panel">
                <div className="register-form__group">
                  <label htmlFor="password">Password</label>
                  <div className="register-form__input-wrap">
                    <Lock size={18} className="register-form__icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Create a password"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="register-form__toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="register-form__group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="register-form__input-wrap">
                    <Lock size={18} className="register-form__icon" />
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="register-form__toggle"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </form>
        </div>

        <div className="register-wizard__actions">
          {step > 1 ? (
            <button type="button" className="register-wizard__btn register-wizard__btn--outline" onClick={handleBack}>
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <Link to="/" className="register-wizard__btn register-wizard__btn--outline">
              <ArrowLeft size={16} />
              Cancel
            </Link>
          )}

          {!isLastStep ? (
            <button
              type="button"
              className="register-wizard__btn register-wizard__btn--primary"
              onClick={handleNext}
              disabled={isBusy}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="register-wizard__btn register-wizard__btn--primary"
              onClick={handleSubmit}
              disabled={isBusy}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="auth-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>

        <p className="register-wizard__mobile-login">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </main>
    </div>
  );
}

export default Register;
