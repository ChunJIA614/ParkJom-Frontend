import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Compass, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import GoogleLoginButton from '../components/GoogleLoginButton';
import LoginMagneticCars from '../components/LoginMagneticCars';
import BrandLogo from '@/components/ui/BrandLogo';
import { useTheme } from '@/app/theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { loginManagement, managementSessionFromLogin } from '@/features/management/api/managementApi';
import '../login.css';

type LoginMode = 'commuter' | 'management';

export default function LoginPage() {
  const { isDark, toggleTheme } = useTheme();
  const { setUser, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(searchParams.get('role') === 'PropertyManagement' ? 'management' : 'commuter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleContinueAsGuest = () => {
    continueAsGuest();
    navigate('/commuter', { replace: true });
  };

  const handleManagementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your property management email and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await loginManagement(email, password);
      setUser(managementSessionFromLogin(response));
      navigate('/management', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page__art" aria-hidden="true" />
      <LoginMagneticCars />
      <header className="login-topbar">
        <a href="/home" className="login-wordmark" aria-label="ParkJom home">
          <BrandLogo className="h-10 w-10" />
          <span>ParkJom<span className="login-wordmark__dot">.</span></span>
        </a>
        <button type="button" onClick={toggleTheme} className="login-theme-button" aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}>
          {isDark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>

      <div className="login-page__layout">
        <section className="login-form-pane" aria-labelledby="login-title">
          <div className="login-form-heading">
            <p className="login-eyebrow">YOUR EVERYDAY PARKING, SORTED</p>
            <h1 id="login-title">{mode === 'management' ? 'Property Desk' : 'Sign in to ParkJom'}</h1>
            <p>{mode === 'management' ? 'Use the account issued for your building.' : 'Your parking, bookings and wallet in one place.'}</p>
          </div>

          <div className="login-mode-switch" aria-label="Sign-in options">
            <button type="button" aria-pressed={mode === 'commuter'} onClick={() => { setMode('commuter'); setError(''); }}>Commuter &amp; Owner</button>
            <button type="button" aria-pressed={mode === 'management'} onClick={() => { setMode('management'); setError(''); }}><Building2 size={15} />Property Desk</button>
          </div>

          {mode === 'commuter' ? (
            <div className="login-commuter-form">
              <GoogleLoginButton />
              <div className="login-divider"><span>or take a look around</span></div>
              <button type="button" onClick={handleContinueAsGuest} className="login-guest-button"><Compass size={18} /><span>Browse as Guest</span><ArrowRight size={17} /></button>
              <p className="login-small-note">No account needed to explore parking and transit.</p>
            </div>
          ) : (
            <form onSubmit={handleManagementSubmit} className="login-management-form" noValidate>
              <label htmlFor="management-email">Work email</label>
              <input id="management-email" type="email" inputMode="email" autoComplete="username" required placeholder="you@yourbuilding.my" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} />
              <label htmlFor="management-password">Password</label>
              <div className="login-password-field">
                <input id="management-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {error && <p role="alert" className="login-form-error">{error}</p>}
              <button type="submit" disabled={submitting} className="login-submit-button">{submitting ? <><Loader2 size={17} className="animate-spin" />Signing in…</> : <>Sign in to Property Desk<ArrowRight size={17} /></>}</button>
              <p className="login-small-note">New here? Use your email invitation to set up your password.</p>
            </form>
          )}

          <a href="/home" className="login-home-link"><ArrowLeft size={15} />Back to Home</a>
        </section>
      </div>

      <footer className="login-page__footer"><span>Made for the everyday commute.</span><span>Klang Valley, Malaysia</span></footer>
    </main>
  );
}
