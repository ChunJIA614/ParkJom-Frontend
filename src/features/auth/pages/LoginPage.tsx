import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Compass, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import GoogleLoginButton from '../components/GoogleLoginButton';
import BrandLogo from '@/components/ui/BrandLogo';
import DotWaveBackground from '@/components/canvas/DotWaveBackground';
import { useTheme } from '@/app/theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { loginManagement, managementSessionFromLogin } from '@/features/management/api/managementApi';

type LoginMode = 'commuter' | 'management';

export default function LoginPage() {
  const { isDark, toggleTheme } = useTheme();
  const { setUser, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>('commuter');
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
    <main className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none bg-[var(--bg-surface,#f5f5f7)] dark:bg-[#000000] transition-colors duration-500">
      {/* 1. ParkJom 3D Interactive Transit Matrix Background */}
      <DotWaveBackground
        gap={32}
        baseRadius={1.3}
        interactionRadius={190}
        magneticPullXY={44}
        magneticPullZ={65}
        stiffness={0.08}
        damping={0.82}
        waveSpeed={0.0016}
        waveAmplitudeZ={26}
        waveAmplitudeY={16}
        pitchAngleDeg={38}
        fov={750}
        cameraZ={620}
        maxScale={2.2}
        glowEnabled={true}
      />

      {/* 2. Floating Top-Right Appearance Control (Apple HIG Icon-Only Glass Pill) */}
      <aside aria-label="Appearance controls" className="fixed top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Appearance' : 'Switch to Dark Appearance'}
          aria-label={isDark ? 'Switch to Light Appearance' : 'Switch to Dark Appearance'}
          className="apple-floating-pill h-11 w-11 rounded-full flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm"
        >
          {isDark ? (
            <Sun size={18} strokeWidth={2.2} className="text-[#0a84ff]" />
          ) : (
            <Moon size={18} strokeWidth={2.2} className="text-[#0071e3]" />
          )}
        </button>
      </aside>

      {/* 3. Centered Apple-Style Frosted Glass Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="apple-glass-card relative z-10 px-5 py-7 sm:px-8 sm:py-8 max-w-[420px] w-full text-center space-y-5"
      >
        {/* Brand App Icon / Logo */}
        <div className="flex justify-center">
          <div className="relative group">
            <BrandLogo className="h-16 w-16 drop-shadow-[0_8px_16px_rgba(0,113,227,0.18)] dark:drop-shadow-[0_8px_20px_rgba(10,132,255,0.25)] transition-transform duration-300 group-hover:scale-105" />
          </div>
        </div>

        {/* Header Typography */}
        <div className="space-y-1.5">
          <h1 className="text-[23px] sm:text-[25px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.025em]">
            {mode === 'management' ? 'Property Management' : 'Welcome to ParkJom'}
          </h1>
          <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
            {mode === 'management'
              ? 'Sign in with the email and password issued for your building.'
              : 'Malaysia\u2019s peer-to-peer transit parking platform'}
          </p>
        </div>

        {/* Sign-in Mode Segmented Control */}
        <div
          role="tablist"
          aria-label="Account type"
          className="grid grid-cols-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] p-1 text-[12px] font-semibold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'commuter'}
            onClick={() => { setMode('commuter'); setError(''); }}
            className={`min-h-9 rounded-lg px-3 py-1.5 transition-all ${
              mode === 'commuter'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-sm'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
            }`}
          >
            Commuter &amp; Owner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'management'}
            onClick={() => { setMode('management'); setError(''); }}
            className={`min-h-9 rounded-lg px-3 py-1.5 inline-flex items-center justify-center gap-1.5 transition-all ${
              mode === 'management'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-sm'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
            }`}
          >
            <Building2 size={13} aria-hidden="true" />
            <span>Property Desk</span>
          </button>
        </div>

        {mode === 'commuter' ? (
          <div className="pt-1 space-y-3.5">
            <GoogleLoginButton />

            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-black/[0.08] dark:border-white/[0.12]" />
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-[#8e8e93] dark:text-[#a1a1a6] uppercase tracking-wider">
                Or explore first
              </span>
              <div className="flex-grow border-t border-black/[0.08] dark:border-white/[0.12]" />
            </div>

            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="w-full min-h-11 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] inline-flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99] cursor-pointer"
            >
              <Compass size={16} className="text-[#0071e3] dark:text-[#0a84ff]" />
              <span>Browse as Guest</span>
            </button>
            <p className="text-[11px] text-[#8e8e93] dark:text-[#a1a1a6] leading-relaxed">
              Explore available bays &amp; transit lines without signing in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleManagementSubmit} className="space-y-3.5 text-left pt-1" noValidate>
            <div>
              <label
                htmlFor="management-email"
                className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5"
              >
                Work email
              </label>
              <input
                id="management-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                placeholder="guardhouse@residence.my"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-white/90 dark:bg-[#1c1c1e] text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#6e6e73] dark:placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/35 focus:border-[#0071e3]"
              />
            </div>

            <div>
              <label
                htmlFor="management-password"
                className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="management-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full min-h-11 pl-3.5 pr-11 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-white/90 dark:bg-[#1c1c1e] text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#6e6e73] dark:placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/35 focus:border-[#0071e3]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg inline-flex items-center justify-center text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[#c9342f]/25 bg-[#fff1f0] dark:bg-red-950/40 px-3 py-2 text-[12px] font-medium text-[#c9342f] dark:text-[#ff6961]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-11 rounded-xl bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0066d6] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In to Property Desk</span>
              )}
            </button>

            <p className="text-[11px] text-center text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
              First time? Open the invitation link sent to your email to set your password.
            </p>
          </form>
        )}

        {/* Back to Home Link (ParkJom Apple System Blue) */}
        <div className="pt-1">
          <a
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--system-primary,#0071E3)] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={13} strokeWidth={2.2} />
            Back to Home
          </a>
        </div>
      </motion.div>
    </main>
  );
}
