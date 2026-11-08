import { useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Moon, ShieldAlert, Sun } from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';
import DotWaveBackground from '@/components/canvas/DotWaveBackground';
import { useTheme } from '@/app/theme/ThemeContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { activateManagementInvitation, managementSessionFromLogin } from '../api/managementApi';

const MIN_PASSWORD_LENGTH = 12;

export default function ManagementInvitationPage() {
  const { isDark, toggleTheme } = useTheme();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlToken = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams]);
  const [manualToken, setManualToken] = useState('');
  const invitationToken = urlToken || manualToken.trim();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lengthMet = newPassword.length >= MIN_PASSWORD_LENGTH;
  const matchMet = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitationToken) {
      setError('This invitation link is missing its security token. Paste the token from your email or request a new link.');
      return;
    }
    if (!lengthMet) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!matchMet) {
      setError('Passwords do not match. Re-enter the same password in both fields.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const response = await activateManagementInvitation(invitationToken, newPassword);
      setUser(managementSessionFromLogin(response));
      navigate('/management', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate your management account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none bg-[var(--bg-surface,#f5f5f7)] dark:bg-[#000000] transition-colors duration-500">
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

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="apple-glass-card relative z-10 px-5 py-7 sm:px-8 sm:py-8 max-w-[440px] w-full text-left space-y-5"
      >
        <div className="flex items-center gap-3.5">
          <BrandLogo className="h-12 w-12 shrink-0 drop-shadow-[0_8px_16px_rgba(0,113,227,0.18)]" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0071e3] dark:text-[#0a84ff]">
              Property Management Invitation
            </p>
            <h1 className="text-[20px] sm:text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.025em]">
              Activate Your Account
            </h1>
          </div>
        </div>

        <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
          Set a password for your building’s ParkJom management desk. This invitation link is single-use and signs you in immediately once activated.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!urlToken && (
            <div className="rounded-xl border border-[#a15c00]/25 bg-[#fff8e8] dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2 text-[12px] font-medium text-[#a15c00] dark:text-amber-300">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>No invitation token was found in the page address. Paste the token from your invitation email below.</span>
              </div>
              <label htmlFor="invitation-token" className="sr-only">Invitation token</label>
              <input
                id="invitation-token"
                type="text"
                required
                placeholder="Paste invitation token…"
                value={manualToken}
                onChange={(e) => { setManualToken(e.target.value); setError(''); }}
                className="w-full min-h-10 px-3 py-2 rounded-lg border border-black/[0.12] dark:border-white/[0.16] bg-white dark:bg-[#1c1c1e] text-[12px] font-mono text-[#1d1d1f] dark:text-[#f5f5f7]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
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

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={128}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              className="w-full min-h-11 px-3.5 py-2.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-white/90 dark:bg-[#1c1c1e] text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#6e6e73] dark:placeholder:text-[#8e8e93] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/35 focus:border-[#0071e3]"
            />
          </div>

          {/* Dynamic validation checklist */}
          <ul className="space-y-1.5 text-[12px]" aria-live="polite">
            <li className={`flex items-center gap-2 ${lengthMet ? 'text-[#248a3d] dark:text-[#30d158]' : 'text-[#6e6e73] dark:text-[#a1a1a6]'}`}>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>12 to 128 characters ({newPassword.length}/{MIN_PASSWORD_LENGTH})</span>
            </li>
            <li className={`flex items-center gap-2 ${matchMet ? 'text-[#248a3d] dark:text-[#30d158]' : 'text-[#6e6e73] dark:text-[#a1a1a6]'}`}>
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>Both password fields match</span>
            </li>
          </ul>

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
                <span>Activating Account…</span>
              </>
            ) : (
              <>
                <KeyRound size={16} aria-hidden="true" />
                <span>Set Password &amp; Enter Desk</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-1 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--system-primary,#0071E3)] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={13} strokeWidth={2.2} />
            Back to Sign In
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
