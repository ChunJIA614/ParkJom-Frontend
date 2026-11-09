import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, SlidersHorizontal, Loader2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { NotificationItem } from './NotificationItem';

interface NotificationBellProps {
  onNavigate?: (url: string) => void;
  onOpenPreferences?: () => void;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigate,
  onOpenPreferences,
  className = '',
}) => {
  const { items, unreadCount, markRead, markAllRead, loadMore, hasMore, isLoading } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigate = (url: string) => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate(url);
    } else {
      navigate(url);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        aria-controls="notification-popover"
        className="relative p-2 text-[#5f6368] dark:text-[#a1a1a6] hover:text-[#111] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.08] rounded-xl transition-colors focus:outline-none"
      >
        <Bell size={18} strokeWidth={2} />

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-[#ff3b30] text-white text-[9px] font-bold rounded-full leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div
            id="notification-popover"
            role="dialog"
            aria-label="Notification center"
            className="workspace-popover absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-[#f1f3f4] dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#111] dark:text-white">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline font-medium"
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all</span>
                  </button>
                )}
                {onOpenPreferences && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenPreferences();
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                    title="Notification Settings"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <p className="font-medium text-slate-600 dark:text-slate-400">No notifications yet</p>
                  <p className="mt-1 text-[11px]">You're all caught up with your bookings and alerts.</p>
                </div>
              ) : (
                items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    onRead={(id) => markRead([id])}
                    onNavigate={handleNavigate}
                  />
                ))
              )}

              {hasMore && (
                <div className="p-2.5 text-center bg-slate-50/50 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="text-[11px] text-[#007AFF] font-medium hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoading && <Loader2 size={12} className="animate-spin" />}
                    <span>{isLoading ? 'Loading...' : 'Load older updates'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer action to full notification center */}
            <div className="p-2.5 bg-slate-50 dark:bg-white/[0.04] border-t border-slate-100 dark:border-white/[0.08] text-center">
              <button
                type="button"
                onClick={() => handleNavigate('/notifications')}
                className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
              >
                View all in Notification Center →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
