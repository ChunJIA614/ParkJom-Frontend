import { motion } from 'motion/react';
import GoogleLoginButton from '../components/GoogleLoginButton';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        className="bg-white rounded-[28px] border border-black/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-8 max-w-sm w-full space-y-6 text-center"
      >
        <div className="w-16 h-16 rounded-[20px] bg-[#007AFF] flex items-center justify-center font-bold text-white text-2xl mx-auto shadow-lg">
          PJ
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-[-0.02em]">Welcome to ParkJom</h1>
          <p className="text-[13px] text-[#6e6e73] mt-2 leading-relaxed">
            Malaysia&apos;s peer-to-peer transit parking platform
          </p>
        </div>
        <GoogleLoginButton />
        <a href="/" className="block text-[13px] text-[#007AFF] font-medium hover:underline transition">
          ← Back to Home
        </a>
      </motion.div>
    </div>
  );
}
