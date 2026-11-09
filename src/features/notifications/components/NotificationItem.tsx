import React from 'react';
import {
  CalendarCheck,
  Wallet,
  Building2,
  AlertTriangle,
  HelpCircle,
  Info,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { NotificationDto } from '../types';

interface NotificationItemProps {
  notification: NotificationDto;
  onRead: (id: number) => void;
  onNavigate?: (url: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onNavigate,
}) => {
  const isUnread = !notification.readAt;
  const isCritical = notification.priority === 'Critical';

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getIcon = () => {
    const size = 16;
    switch (notification.category) {
      case 'Booking':
        return <CalendarCheck size={size} className="text-emerald-600 dark:text-emerald-400" />;
      case 'Wallet':
        return <Wallet size={size} className="text-blue-600 dark:text-blue-400" />;
      case 'Listing':
        return <Building2 size={size} className="text-amber-600 dark:text-amber-400" />;
      case 'Support':
        return <HelpCircle size={size} className="text-purple-600 dark:text-purple-400" />;
      case 'Account':
        return <ShieldAlert size={size} className="text-rose-600 dark:text-rose-400" />;
      default:
        return <Info size={size} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const handleClick = () => {
    if (isUnread) {
      onRead(notification.id);
    }
    if (notification.actionUrl && onNavigate) {
      onNavigate(notification.actionUrl);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`px-4 py-3.5 transition-colors cursor-pointer border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-left relative flex gap-3 items-start ${
        isUnread ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : 'bg-transparent'
      } ${isCritical ? 'border-l-4 border-l-rose-500' : ''}`}
    >
      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.08] shrink-0">
        {getIcon()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-slate-900 dark:text-white truncate">
            {notification.title}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">
            {formatTime(notification.createdAt)}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
          {notification.body}
        </p>
      </div>

      {isUnread && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0 animate-pulse" />
      )}
    </div>
  );
};
