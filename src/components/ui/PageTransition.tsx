import { useLayoutEffect, type RefObject } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export default function PageTransition({ children, transitionKey, className = '', scrollContainerRef }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const top = { top: 0, left: 0, behavior: 'instant' } as const;
    window.scrollTo(top);
    scrollContainerRef?.current?.scrollTo(top);
  }, [transitionKey, scrollContainerRef]);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
        transition={prefersReducedMotion
          ? { duration: 0.12, ease: 'linear' }
          : { type: 'spring', bounce: 0, duration: 0.34 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
