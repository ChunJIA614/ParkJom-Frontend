import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getGuideCardPosition } from './guidePosition';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  Compass,
  LayoutDashboard,
  Map,
  MessageSquare,
  PlusSquare,
  Unlock,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

export interface GuideStep {
  id: string;
  mobileId?: string;
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
}

interface FirstTimeIconGuideProps {
  open: boolean;
  role: 'Commuter' | 'Owner';
  userName?: string;
  onSelectTab: (tabId: string) => void;
  onComplete: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  source: 'sidebar' | 'bottomnav' | 'none';
}

const COMMUTER_STEPS: GuideStep[] = [
  {
    id: 'home',
    mobileId: 'home',
    icon: Compass,
    label: 'Browse',
    title: 'Browse Verified Bays',
    description:
      'Discover and filter verified parking bays near LRT and MRT stations, including covered and EV-ready spots.',
  },
  {
    id: 'map',
    mobileId: 'map',
    icon: Map,
    label: 'Transit Map',
    title: 'Interactive Transit Map',
    description:
      'Pick any LRT, MRT, or Monorail station to compare nearby parking bays and walking distances.',
  },
  {
    id: 'active',
    mobileId: 'active',
    icon: Unlock,
    label: 'My Pass',
    title: 'Digital Pass & Gate Access',
    description:
      'Open your active booking on arrival to verify your license plate at the barrier gate and unlock your bay.',
  },
  {
    id: 'wallet',
    mobileId: 'wallet',
    icon: Wallet,
    label: 'Wallet',
    title: 'Wallet & Receipts',
    description:
      'Top up your balance and review every booking payment or receipt in one place.',
  },
  {
    id: 'profile',
    mobileId: 'more',
    icon: Car,
    label: 'Vehicles',
    title: 'Saved Vehicles',
    description:
      'Save your vehicle license plate in advance so the barrier gate opens on arrival.',
  },
];

const OWNER_STEPS: GuideStep[] = [
  {
    id: 'dashboard',
    mobileId: 'dashboard',
    icon: LayoutDashboard,
    label: 'Overview',
    title: 'Live Bay Overview',
    description:
      'Monitor real-time bay status, active commuter bookings, and daily occupancy across your properties.',
  },
  {
    id: 'registration',
    mobileId: 'registration',
    icon: PlusSquare,
    label: 'Register Property',
    title: 'Register a New Bay',
    description:
      'Submit a parking bay near a transit station for verification and listing.',
  },
  {
    id: 'availability',
    mobileId: 'availability',
    icon: CalendarDays,
    label: 'Configure Parking',
    title: 'Rates & Availability',
    description:
      'Set your daily rental rates, operating hours, and custom availability schedule.',
  },
  {
    id: 'reviews',
    mobileId: 'reviews',
    icon: MessageSquare,
    label: 'Reviews',
    title: 'Commuter Reviews',
    description:
      'Read ratings from commuters who parked at your bay and post owner replies.',
  },
  {
    id: 'wallet',
    mobileId: 'more',
    icon: Wallet,
    label: 'Earnings Wallet',
    title: 'Earnings & Payouts',
    description:
      'Track settled rental income and request withdrawals to your bank account.',
  },
];

function findVisibleTarget(step: GuideStep): TargetRect {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  const candidates = [
    { selector: '[data-tour-bottomnav-id="' + (step.mobileId ?? step.id) + '"]', source: 'bottomnav' as const },
    { selector: '[data-tour-sidebar-id="' + step.id + '"]', source: 'sidebar' as const },
  ];
  if (!mobile) candidates.reverse();
  for (const candidate of candidates) {
    const element = document.querySelector<HTMLElement>(candidate.selector);
    if (!element || getComputedStyle(element).visibility === 'hidden') continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth
        && rect.top >= 0 && rect.bottom <= window.innerHeight) {
      return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, source: candidate.source };
    }
  }
  return { top: 0, left: 0, width: 0, height: 0, source: 'none' };
}

export default function FirstTimeIconGuide({
  open,
  role,
  onSelectTab,
  onComplete,
}: FirstTimeIconGuideProps) {
  const steps = useMemo(() => (role === 'Owner' ? OWNER_STEPS : COMMUTER_STEPS), [role]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    source: 'none',
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(280);

  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const card = cardRef.current;
    const measure = () => setCardHeight(card.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [open, currentIndex]);

  const currentStep = steps[currentIndex] ?? steps[0];
  const StepIcon = currentStep.icon;
  const isLastStep = currentIndex === steps.length - 1;

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  const updateMeasurement = useCallback(() => {
    if (!open || !currentStep) return;
    setTargetRect(findVisibleTarget(currentStep));
  }, [currentStep, open]);

  useEffect(() => {
    if (!open) return;
    updateMeasurement();
    const timer = window.setTimeout(updateMeasurement, 120);
    window.addEventListener('resize', updateMeasurement);
    window.addEventListener('scroll', updateMeasurement, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateMeasurement);
      window.removeEventListener('scroll', updateMeasurement, true);
    };
  }, [open, currentIndex, updateMeasurement]);

  const handleFinish = useCallback(() => {
    onSelectTab(role === 'Owner' ? 'dashboard' : 'home');
    onComplete();
  }, [onComplete, onSelectTab, role]);

  const handleSpotlitIconClick = useCallback(() => {
    if (!currentStep) return;
    onSelectTab(currentStep.id);
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }
  }, [currentStep, isLastStep, onComplete, onSelectTab, steps.length]);

  const handleNextButton = useCallback(() => {
    if (!currentStep) return;
    onSelectTab(currentStep.id);
    if (isLastStep) {
      handleFinish();
    } else {
      setCurrentIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }
  }, [currentStep, handleFinish, isLastStep, onSelectTab, steps.length]);

  const handleBackButton = useCallback(() => {
    if (currentIndex <= 0) return;
    const prevStep = steps[currentIndex - 1];
    if (prevStep) {
      onSelectTab(prevStep.id);
    }
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, [currentIndex, onSelectTab, steps]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onComplete();
      } else if (event.key === 'ArrowRight') {
        handleNextButton();
      } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
        handleBackButton();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, handleBackButton, handleNextButton, onComplete, open]);

  if (!open) return null;

  const hasValidTarget = targetRect.source !== 'none' && targetRect.width > 0;
  const pad = 6;
  const spotlightBox = {
    top: Math.max(4, targetRect.top - pad),
    left: Math.max(4, targetRect.left - pad),
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
  };

  const cardStyle = getGuideCardPosition(
    window.visualViewport?.width ?? window.innerWidth,
    window.visualViewport?.height ?? window.innerHeight,
    targetRect,
    cardHeight,
  );

  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[1400] select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="icon-guide-title"
      >
        {/* Dimmed backdrop with clean cutout around the target icon */}
        <svg
          className="fixed inset-0 h-full w-full pointer-events-auto"
          onClick={onComplete}
          aria-hidden="true"
        >
          <defs>
            <mask id="parkjom-icon-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {hasValidTarget && (
                <rect
                  x={spotlightBox.left}
                  y={spotlightBox.top}
                  width={spotlightBox.width}
                  height={spotlightBox.height}
                  rx="14"
                  ry="14"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.45)"
            mask="url(#parkjom-icon-spotlight-mask)"
          />
        </svg>

        {/* Interactive highlight ring around the target navigation item */}
        {hasValidTarget && (
          <motion.button
            key={`spotlight-${currentStep.id}`}
            type="button"
            onClick={handleSpotlitIconClick}
            aria-label={`Select ${currentStep.label}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              top: `${spotlightBox.top}px`,
              left: `${spotlightBox.left}px`,
              width: `${spotlightBox.width}px`,
              height: `${spotlightBox.height}px`,
            }}
            className="fixed z-[1410] rounded-[14px] ring-2 ring-[#0071e3] dark:ring-[#0a84ff] shadow-[0_0_0_4px_rgba(0,113,227,0.22)] cursor-pointer focus:outline-none"
          />
        )}

        {/* Restrained Apple popover coach-mark */}
        <motion.div
          key={`card-${currentStep.id}`}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          ref={cardRef}
          style={cardStyle}
          className="icon-guide-card fixed z-[1420] overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.08] dark:border-white/[0.14] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl p-5 shadow-[0_20px_48px_rgba(0,0,0,0.28)] text-left space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-[0.02em] text-[#6e6e73] dark:text-[#98989d]">
              {currentIndex + 1} of {steps.length} · Tap the highlighted icon
            </span>
            <button
              type="button"
              onClick={onComplete}
              aria-label="Close guide"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg -mr-2 text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#0a84ff]">
              <StepIcon size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3
                id="icon-guide-title"
                className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.015em]"
              >
                {currentStep.title}
              </h3>
              <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onComplete}
              className="min-h-11 min-w-11 px-2 -ml-2 rounded-lg text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
            >
              Skip
            </button>

            <div className="flex items-center gap-1.5">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={handleBackButton}
                  aria-label="Previous icon"
                  className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={handleNextButton}
                className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl bg-[#0071e3] hover:bg-[#0066d6] dark:bg-[#0a84ff] dark:hover:bg-[#0071e3] text-white text-[12px] font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <span>{isLastStep ? 'Done' : 'Next'}</span>
                {!isLastStep && <ArrowRight size={13} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
