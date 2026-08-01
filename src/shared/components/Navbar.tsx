import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import BrandLogo from '@/shared/ui/BrandLogo';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e8eaed]">
      <div className="max-w-screen-2xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
        {/* Brand — clickable to go to dashboard */}
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandLogo alt="" className="h-8 w-8 shadow-sm" />
          <span className="font-bold text-[#111] text-[15px] tracking-[-0.02em]">ParkJom</span>
        </div>

        {/* Right side: user + logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-[11px] font-bold">
                {(user.firstName?.charAt(0) || user.email?.charAt(0) || '?')}
              </span>
              <span className="hidden md:inline text-[13px] font-medium text-[#333]">
                {`${user.firstName} ${user.lastName}`.trim() || user.email}
              </span>
            </div>
          )}
          <div className="w-px h-5 bg-[#e8eaed] hidden md:block" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#111] transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
