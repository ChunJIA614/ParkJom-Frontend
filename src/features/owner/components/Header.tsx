import { useEffect, useState } from 'react';
import { Bell, Wallet, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import DashboardHeader, { type DashboardHeaderUser } from '@/components/layout/DashboardHeader';
import { Notification } from '../types';

interface HeaderProps {
  notifications: Notification[];
  user: DashboardHeaderUser | null;
  onSignOut: () => void;
  onBrandClick: () => void;
  onMarkAllRead: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export default function Header({
  notifications,
  user,
  onSignOut,
  onBrandClick,
  onMarkAllRead,
  onToggleSidebar,
  isSidebarOpen,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!showNotifications) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNotifications]);

  const iconFor = (type: string) => {
    switch (type) {
      case 'booking':
        return <CheckCircle2 size={15} className="text-[#16a34a]" />;
      case 'payment':
        return <Wallet size={15} className="text-[#007AFF]" />;
      case 'dispute':
        return <AlertTriangle size={15} className="text-[#d97706]" />;
      default:
        return <Info size={15} className="text-[#9ca3af]" />;
    }
  };

  const notificationActions = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowNotifications(!showNotifications)}
        aria-label="Notifications"
        aria-expanded={showNotifications}
        aria-controls="owner-notifications"
        className="relative p-2 text-[#5f6368] hover:text-[#111] hover:bg-black/[0.04] active:bg-black/[0.06] rounded-xl transition-colors"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#ff3b30] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowNotifications(false)}
            aria-hidden
          />
          <div
            id="owner-notifications"
            role="dialog"
            aria-label="Owner notifications"
            className="workspace-popover absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white border border-black/[0.08] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-2 z-50 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-[#f1f3f4] flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#111]">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllRead();
                    setShowNotifications(false);
                  }}
                  className="text-[11px] text-[#007AFF] font-semibold hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[#f8f9fa] last:border-0 flex gap-3 text-left ${
                    n.unread ? 'bg-[#f8f9fa]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{iconFor(n.type)}</div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#111]">{n.title}</p>
                    <p className="text-[11px] text-[#5f6368] mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-[#9ca3af] mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <DashboardHeader
      role="owner"
      user={user}
      onSignOut={onSignOut}
      onBrandClick={onBrandClick}
      showMenuButton
      onMenuClick={onToggleSidebar}
      menuExpanded={isSidebarOpen}
      menuControls="owner-workspace-navigation"
      statusText="Owner workspace"
      actions={notificationActions}
    />
  );
}
