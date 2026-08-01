import { useNavigate } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import BrandLogo from '@/shared/ui/BrandLogo';

export type DashboardRole = 'commuter' | 'owner' | 'admin';

interface DashboardHeaderProps {
  role: DashboardRole;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  /** Extra controls rendered before the user / sign-out area (e.g. notifications) */
  actions?: React.ReactNode;
  /** Optional primary navigation rendered in the center on desktop */
  navigation?: React.ReactNode;
  /** Optional status line shown on sm+ screens (admin: system status, owner: location) */
  statusText?: string;
  /** Optional badge next to title (owner: Active) */
  badge?: { label: string; variant?: 'success' | 'warning' | 'info' };
}

const ROLE_META: Record<
  DashboardRole,
  { portal: string; accent: string; homePath: string }
> = {
  commuter: { portal: 'Transit Parking', accent: '#007AFF', homePath: '/commuter' },
  owner: { portal: 'Owner Portal', accent: '#007AFF', homePath: '/owner' },
  admin: { portal: 'Admin Console', accent: '#007AFF', homePath: '/admin' },
};

const BADGE_STYLES = {
  success: 'bg-[#f0fdf4] text-[#16a34a]',
  warning: 'bg-[#fefce8] text-[#a16207]',
  info: 'bg-[#e8f0fe] text-[#007AFF]',
};

export default function DashboardHeader({
  role,
  onMenuClick,
  showMenuButton = false,
  actions,
  navigation,
  statusText,
  badge,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const meta = ROLE_META[role];

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const handleBrandClick = () => {
    navigate(meta.homePath);
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : '';
  const initials = (user?.firstName?.charAt(0) || user?.email?.charAt(0))?.toUpperCase() ?? '?';

  return (
    <header
      className="sticky top-0 z-50 shrink-0 glass-bar"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="relative max-w-screen-2xl mx-auto h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Left: menu + brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showMenuButton && onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="lg:hidden -ml-1 p-2 rounded-xl text-[#5f6368] hover:text-[#111] hover:bg-black/[0.04] active:bg-black/[0.06] transition-colors"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            onClick={handleBrandClick}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            <BrandLogo alt="" className="h-8 w-8 shadow-sm transition-transform group-active:scale-95" />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-[#111] tracking-[-0.02em] truncate">
                  ParkJom
                </span>
                {badge && (
                  <span
                    className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      BADGE_STYLES[badge.variant ?? 'success']
                    }`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6e6e73] font-medium leading-none mt-0.5 truncate hidden sm:block">
                {meta.portal}
              </p>
            </div>
          </button>
        </div>

        {navigation && (
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1" aria-label="Primary">
            {navigation}
          </nav>
        )}

        {/* Center status — desktop only */}
        {statusText && (
          <div className="hidden md:flex items-center gap-2 text-[12px] font-medium text-[#5f6368] mx-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] shrink-0" />
            <span className="truncate">{statusText}</span>
          </div>
        )}

        {/* Right: actions + user + sign out */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {actions}

          {user && (
            <div className="hidden sm:flex items-center gap-2 pl-1">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-black/[0.06]"
                />
              ) : (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ring-black/[0.06]"
                  style={{
                    backgroundColor: '#e8f0fe',
                    color: '#007AFF',
                  }}
                >
                  {initials}
                </span>
              )}
              <span className="hidden lg:inline text-[13px] font-medium text-[#333] max-w-[120px] truncate">
                {displayName}
              </span>
            </div>
          )}

          <div className="hidden sm:block w-px h-5 bg-[#e8eaed] mx-0.5" />

          {/* Sign out — always visible; icon-only on mobile, label on sm+ */}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-[13px] font-medium text-[#5f6368] hover:text-[#111] hover:bg-black/[0.04] active:bg-black/[0.06] transition-colors"
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
