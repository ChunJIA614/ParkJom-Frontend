import { motion } from 'motion/react';

export default function SplashScreen() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-14 h-14 rounded-[18px] bg-[#007AFF] flex items-center justify-center font-bold text-white text-xl shadow-lg animate-splash-pulse">
          PJ
        </div>
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
