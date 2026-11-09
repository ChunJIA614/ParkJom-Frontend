import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import BrandLogo from '@/components/ui/BrandLogo';
import type { AuthUser } from '@/features/auth/context/AuthContext';
import { isFirstTimeUserForTour, isNewRegisteredUser } from './onboardingStorage';

interface WelcomeLoadingScreenProps {
  user: AuthUser;
  onComplete: () => void;
}

const HAND_DRAWN_BG_SRC = '/images/welcome-hand-drawn-bg.jpg';

export default function WelcomeLoadingScreen({ user, onComplete }: WelcomeLoadingScreenProps) {
  const prefersReducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(prefersReducedMotion ? 100 : 6);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isOwner = user.role === 'Owner';
  const isFirstTime = useMemo(
    () => isNewRegisteredUser(user.userId) || isFirstTimeUserForTour(user.userId, user.role),
    [user.role, user.userId],
  );

  const displayName = useMemo(() => {
    const first = user.firstName?.trim();
    if (first) return first;
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (full) return full;
    return user.email?.split('@')[0] || 'there';
  }, [user.email, user.firstName, user.lastName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onComplete]);

  useEffect(() => {
    if (prefersReducedMotion) {
      const immediateTimer = window.setTimeout(onComplete, 450);
      return () => window.clearTimeout(immediateTimer);
    }

    const startTime = performance.now();
    const totalDuration = 2200;
    let animationFrame: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / totalDuration);
      // Smooth cubic ease-out for steady determinate advancement
      const eased = 1 - Math.pow(1 - ratio, 3);
      const nextProgress = Math.min(100, Math.round(6 + eased * 94));
      setProgress(nextProgress);

      if (ratio < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);
    const finishTimer = window.setTimeout(onComplete, totalDuration + 200);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(finishTimer);
    };
  }, [onComplete, prefersReducedMotion]);

  const statusLine = isOwner
    ? 'Syncing your parking bays and availability schedule.'
    : 'Syncing nearby LRT & MRT station bays and your digital pass.';

  return (
    <main
      className="fixed inset-0 z-50 h-screen w-screen overflow-hidden select-none bg-[#d8eef9]"
      aria-live="polite"
      aria-busy={progress < 100}
      aria-label="Welcome to ParkJom"
    >
      {/* Full-bleed hand-drawn watercolor background (threerocks/hand-drawn-styles #3 Ghibli recipe) */}
      <motion.img
        src={HAND_DRAWN_BG_SRC}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        onLoad={() => setImageLoaded(true)}
        initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.03 }}
        animate={{ opacity: imageLoaded ? 1 : 0.85, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 h-full w-full object-cover object-[64%_center] sm:object-center pointer-events-none"
      />

      {/* Subtle atmospheric sky veil in the upper-left negative space to guarantee >= 7:1 text contrast */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_18%_22%,rgba(248,252,255,0.72)_0%,rgba(248,252,255,0.28)_52%,rgba(248,252,255,0)_85%)]"
      />

      {/* Safe-area layout container */}
      <div className="relative z-10 flex h-full w-full flex-col justify-between p-6 sm:p-12 md:p-16">
        {/* Top bar: Minimal brand mark & quiet Skip action */}
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5">
            <BrandLogo className="h-8 w-8" />
            <span className="text-[14px] font-semibold tracking-[-0.015em] text-[#1d1d1f]/85">
              ParkJom
            </span>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="min-h-11 px-3 -mr-3 text-[13px] font-medium text-[#1d1d1f]/65 hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            Skip
          </button>
        </header>

        {/* Upper-left open sky editorial lockup — zero cards, zero badges, pure typography */}
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="my-auto max-w-[460px] pb-16 sm:pb-24 space-y-5"
        >
          <div className="space-y-2">
            <p className="text-[12px] font-medium tracking-[0.04em] uppercase text-[#1d1d1f]/60">
              {isOwner ? 'Property Owner' : 'Commuter & Renter'}
            </p>
            <h1 className="text-[32px] sm:text-[44px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#1d1d1f]">
              {isFirstTime ? `Welcome, ${displayName}.` : `Welcome back, ${displayName}.`}
            </h1>
            <p className="text-[15px] sm:text-[16px] font-normal text-[#1d1d1f]/75 leading-relaxed pt-1">
              {statusLine}
            </p>
          </div>

          {/* Single determinate progress bar (Apple HIG Progress Indicators) */}
          <div className="pt-1 space-y-2 max-w-[260px]">
            <div
              className="h-[3px] w-full overflow-hidden rounded-full bg-[#1d1d1f]/14"
              role="progressbar"
              aria-label={statusLine}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full rounded-full bg-[#1d1d1f]/85"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.section>

        {/* Bottom spacer to preserve full view of the hand-drawn car & station platform */}
        <div aria-hidden="true" className="h-4" />
      </div>
    </main>
  );
}
