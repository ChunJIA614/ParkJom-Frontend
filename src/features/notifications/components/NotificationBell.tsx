import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, SlidersHorizontal, Loader2, X } from 'lucide-react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const anchor = dropdownRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const width = Math.min(352, viewportWidth - 24);
      const top = Math.max(12, Math.min(anchor.bottom + 8, viewportHeight - 160));
      setPanelStyle({
        width,
        top,
        left: Math.max(12, Math.min(anchor.right - width, viewportWidth - width - 12)),
        maxHeight: viewportHeight - top - 12,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        dropdownRef.current?.querySelector('button')?.focus();
      }
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
      {isOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-[1190] cursor-default"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div
            id="notification-popover"
            role="dialog"
            aria-label="Notification center"
            ref={panelRef}
            style={panelStyle}
            className="notification-panel fixed flex flex-col bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.12] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] py-2 z-[1200] overflow-hidden animate-in fade-in duration-150"
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-1 border-b border-[#f1f3f4] dark:border-white/[0.08] flex items-center justify-between gap-2">
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
                    className="min-h-11 flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline font-medium"
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
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close notifications" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"><X size={17} /></button>
              </div>
            </div>

            {/* Notification List */}
            <div className="min-h-0 max-h-80 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-white/[0.06]">
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
            <div className="shrink-0 p-2.5 bg-slate-50 dark:bg-white/[0.04] border-t border-slate-100 dark:border-white/[0.08] text-center">
              <button
                type="button"
                onClick={() => handleNavigate('/notifications')}
                className="min-h-11 text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer"
              >
                View all in Notification Center →
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};
