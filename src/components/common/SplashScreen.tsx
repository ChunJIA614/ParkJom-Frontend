import { motion } from 'motion/react';
import BrandLogo from '@/components/ui/BrandLogo';

export default function SplashScreen() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <BrandLogo className="h-16 w-16 shadow-lg animate-splash-pulse" />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-[13px] text-[#6e6e73] font-medium tracking-[-0.01em]"
        >
          ParkJom
        </motion.p>
      </motion.div>
    </div>
  );
}
