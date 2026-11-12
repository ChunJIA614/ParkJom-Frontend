import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, Bot, Calendar, CreditCard, Lock, Sparkles, X, ShieldCheck } from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';

export interface GuestLoginPromptModalProps {
  isOpen: boolean;
  featureName?: string;
  reason?: string;
  onClose: () => void;
  onSignIn: () => void;
}

export default function GuestLoginPromptModal({
  isOpen,
  featureName,
  reason,
  onClose,
  onSignIn,
}: GuestLoginPromptModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', bounce: 0.16, duration: 0.35 }}
            className="relative w-full max-w-[460px] rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 p-6 sm:p-8 text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xl border border-black/[0.08] dark:border-white/[0.14] backdrop-blur-2xl z-10 overflow-hidden"
          >
            {/* Ambient decorative glow */}
            <div
              className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#0071e3]/15 dark:bg-[#0a84ff]/20 blur-3xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/10 dark:bg-emerald-400/15 blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header Content */}
            <div className="flex flex-col items-center text-center space-y-3.5">
              {/* Badge & Icon */}
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0a84ff]/15 flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] shadow-inner ring-1 ring-[#0071e3]/20">
                  {featureName?.toLowerCase().includes('copilot') || featureName?.toLowerCase().includes('ai') ? (
                    <Bot size={28} strokeWidth={2.2} />
                  ) : featureName?.toLowerCase().includes('wallet') ? (
                    <CreditCard size={28} strokeWidth={2.2} />
                  ) : featureName?.toLowerCase().includes('book') || featureName?.toLowerCase().includes('reserve') ? (
                    <Calendar size={28} strokeWidth={2.2} />
                  ) : (
                    <Lock size={26} strokeWidth={2.2} />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#0071e3] text-white flex items-center justify-center shadow-md">
                  <Sparkles size={13} strokeWidth={2.4} />
                </div>
              </div>

              <div className="space-y-1">
                <span className="inline-block text-[11px] font-semibold tracking-wider uppercase text-[#0071e3] dark:text-[#0a84ff]">
                  {featureName ? `Sign in for ${featureName}` : 'Sign in Required'}
                </span>
                <h2 id="guest-modal-title" className="text-[20px] sm:text-[22px] font-bold tracking-tight">
                  {featureName ? `Sign in to use ${featureName}` : 'Sign in to ParkJom'}
                </h2>
              </div>

              <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed max-w-[380px]">
                {reason ||
                  'Guest mode lets you browse available parking and transit maps. Sign in with Google to book bays, chat with ParkJom AI Copilot, and access your digital passes.'}
              </p>
            </div>

            {/* Feature Perks Checklist */}
            <div className="my-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-4 border border-black/[0.04] dark:border-white/[0.06] space-y-2.5 text-left text-[12px]">
              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={12} strokeWidth={2.5} />
                </div>
                <div>
                  <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Guaranteed Bay Reservations:</strong>{' '}
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Instant confirmation with smart QR and RFID clearance.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-[#0071e3]/10 dark:bg-[#0a84ff]/20 text-[#0071e3] dark:text-[#0a84ff] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={12} strokeWidth={2.5} />
                </div>
                <div>
                  <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">ParkJom AI Copilot:</strong>{' '}
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Multimodal transit routes and real-time congestion predictions.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-purple-500/10 dark:bg-purple-400/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard size={12} strokeWidth={2.5} />
                </div>
                <div>
                  <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Zero-Hassle Wallet:</strong>{' '}
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Save your vehicles, top up easily, and track every commute.</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onSignIn}
                className="w-full min-h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99]"
              >
                <span>Sign In or Create Account</span>
                <ArrowRight size={15} strokeWidth={2.2} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-10 rounded-xl text-[13px] font-medium text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                Continue Browsing as Guest
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
