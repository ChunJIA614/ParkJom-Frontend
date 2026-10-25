import { motion } from 'motion/react';
import GoogleLoginButton from '../components/GoogleLoginButton';
import BrandLogo from '@/components/ui/BrandLogo';
import DotWaveBackground from '@/components/canvas/DotWaveBackground';
import { useTheme } from '@/app/theme/ThemeContext';
import { Sun, Moon, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none bg-[var(--bg-surface,#f5f5f7)] dark:bg-[#090a0f] transition-colors duration-500">
      {/* 1. ParkJom 3D Interactive Transit Matrix Background (Parking, LRT Stations, Commuter Cars) */}
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
          className="apple-floating-pill h-10 w-10 rounded-full flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm"
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
        className="apple-glass-card relative z-10 px-5 py-7 sm:px-8 sm:py-8 max-w-[420px] w-full text-center space-y-6"
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
            Welcome to ParkJom
          </h1>
          <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
            Malaysia&apos;s peer-to-peer transit parking platform
          </p>
        </div>

        {/* Google Authentication Button */}
        <div className="pt-1">
          <GoogleLoginButton />
        </div>

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
