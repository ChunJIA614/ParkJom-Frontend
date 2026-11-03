import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ArrowLeft,
  SlidersHorizontal,
  Inbox,
  Calendar,
  Wallet,
  Home,
  LifeBuoy,
  User,
  Info,
  Check,
} from 'lucide-react';
import { useNotifications } from '../NotificationContext';
import { NotificationItem } from '../NotificationItem';
import { NotificationCategory } from '../types';
import { NotificationPreferences } from '../NotificationPreferences';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getDashboardPath } from '@/app/routes/roleRouting';

const CATEGORIES: { key: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'all', label: 'All', icon: Bell },
  { key: 'Booking', label: 'Bookings', icon: Calendar },
  { key: 'Wallet', label: 'Wallet', icon: Wallet },
  { key: 'Listing', label: 'Listings', icon: Home },
  { key: 'Support', label: 'Support', icon: LifeBuoy },
  { key: 'Account', label: 'Account', icon: User },
  { key: 'System', label: 'System', icon: Info },
];

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    unreadCount,
    markAllRead,
    markRead,
    loadMore,
    hasMore,
    isLoading,
  } = useNotifications();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);

  const filteredNotifications = useMemo(() => {
    return items.filter((n) => {
      if (activeCategory !== 'all' && n.category !== activeCategory) {
        return false;
      }
      if (unreadOnly && n.readAt !== null) {
        return false;
      }
      return true;
    });
  }, [items, activeCategory, unreadOnly]);

  const backPath = getDashboardPath(user?.role);

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#121214] text-[#1d1d1f] dark:text-white transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-black/[0.06] dark:border-white/10 bg-white/80 dark:bg-[#18181c]/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="p-2 -ml-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[#6e6e73] dark:text-[#a1a1aa] transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500 text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-[#242429] border border-black/[0.08] dark:border-white/10 hover:bg-[#f5f5f7] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <CheckCheck size={14} className="text-emerald-500" />
                <span>Mark all read</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPreferences(!showPreferences)}
              className={`p-2 rounded-full border border-black/[0.08] dark:border-white/10 transition-colors cursor-pointer ${
                showPreferences
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white dark:bg-[#242429] text-[#6e6e73] dark:text-[#a1a1aa] hover:bg-[#f5f5f7] dark:hover:bg-white/[0.06]'
              }`}
              title="Notification Settings"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Slide-out / Collapsible Preferences Panel */}
        {showPreferences && (
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#18181c] p-6 shadow-sm">
            <NotificationPreferences onClose={() => setShowPreferences(false)} embedded />
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map(({ key, label, icon: Icon }) => {
              const active = activeCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[var(--workspace-accent,#007AFF)] text-white shadow-sm'
                      : 'bg-white dark:bg-[#18181c] border border-black/[0.06] dark:border-white/10 text-[#6e6e73] dark:text-[#a1a1aa] hover:text-[#1d1d1f] dark:hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Unread Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                unreadOnly
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#18181c] text-[#6e6e73] dark:text-[#a1a1aa]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                  unreadOnly
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-black/[0.2] dark:border-white/20'
                }`}
              >
                {unreadOnly && <Check size={10} strokeWidth={3} />}
              </div>
              <span>Unread only</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {isLoading && items.length === 0 ? (
            <div className="py-20 text-center text-sm text-[#8e8e93] dark:text-[#71717a]">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#18181c] p-8">
              <div className="w-14 h-14 rounded-full bg-black/[0.03] dark:bg-white/[0.04] flex items-center justify-center mb-3 text-[#8e8e93] dark:text-[#71717a]">
                <Inbox size={26} />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f] dark:text-white">
                {unreadOnly ? 'No unread notifications' : 'No notifications in this category'}
              </h3>
              <p className="text-xs text-[#8e8e93] dark:text-[#71717a] mt-1 max-w-sm">
                When you get updates about bookings, parking verifications, or wallet transactions, they will appear here.
              </p>
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => markRead([id])}
                  onNavigate={(url) => navigate(url)}
                />
              ))}

              {hasMore && (
                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => loadMore()}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-full border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#18181c] text-xs font-semibold text-[#007AFF] hover:bg-[#f5f5f7] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? 'Loading older updates...' : 'Load older notifications'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
