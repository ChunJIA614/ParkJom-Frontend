import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
  className?: string;
}

export default function PageTransition({ children, transitionKey, className = '' }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

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
