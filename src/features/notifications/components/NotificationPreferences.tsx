import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { NotificationPreferenceItem } from '../types';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../api/notificationApi';
import { subscribeToWebPush, unsubscribeFromWebPush } from '../lib/push';
import { BellRing, Check, Shield, Loader2 } from 'lucide-react';

interface NotificationPreferencesProps {
  onClose?: () => void;
  embedded?: boolean;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ onClose, embedded = false }) => {
  const { user } = useAuth();
  const token = user?.token;

  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default'>('default');

  useEffect(() => {
    if (!token) return;

    async function load() {
      try {
        setIsLoading(true);
        const res = await fetchNotificationPreferences(token!);
        setPreferences(res.preferences);

        if ('Notification' in window) {
          setPushStatus(Notification.permission);
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [token]);

  const handleToggle = (category: string, channel: string, currentEnabled: boolean, isLocked: boolean) => {
    if (isLocked) return;

    setPreferences((prev) =>
      prev.map((p) =>
        p.category === category && p.channel === channel ? { ...p, enabled: !currentEnabled } : p
      )
    );
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!token) return;

    try {
      setIsSaving(true);
      await updateNotificationPreferences(
        token,
        preferences.map((p) => ({
          category: p.category,
          channel: p.channel,
          enabled: p.enabled,
        }))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePush = async () => {
    if (!token) return;

    if (pushStatus === 'granted') {
      await unsubscribeFromWebPush(token);
      setPushStatus('default');
    } else {
      const ok = await subscribeToWebPush(token);
      if (ok) {
        setPushStatus('granted');
      } else {
        setPushStatus(Notification.permission);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-sm gap-2">
        <Loader2 size={16} className="animate-spin text-emerald-500" />
        <span>Loading preferences...</span>
      </div>
    );
  }

  const categories = Array.from(new Set(preferences.map((p) => p.category)));
  const channels = ['InApp', 'WebPush', 'Email'] as const;

  return (
    <div className={embedded ? "w-full text-left" : "bg-white dark:bg-[#1c1c1e] rounded-2xl p-6 max-w-xl mx-auto border border-slate-200 dark:border-white/[0.1] shadow-xl text-left"}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08] mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Notification Settings
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choose how ParkJom reaches you for each activity category.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : saveSuccess ? <Check size={13} /> : null}
            <span>{saveSuccess ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Push Banner */}
      <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-3.5 mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            <BellRing size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-white">
              Instant Browser Push
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              Receive live gate and overstay alerts even if the tab is inactive.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTogglePush}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            pushStatus === 'granted'
              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          }`}
        >
          {pushStatus === 'granted' ? 'Disable Push' : 'Enable Push'}
        </button>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              <th className="pb-2.5">Category</th>
              <th className="pb-2.5 text-center">In-App</th>
              <th className="pb-2.5 text-center">Web Push</th>
              <th className="pb-2.5 text-center">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {categories.map((cat) => (
              <tr key={cat} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                <td className="py-3 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{cat}</span>
                  {cat === 'Account' && (
                    <span title="Security alerts are mandatory via email">
                      <Shield size={12} className="text-slate-400" />
                    </span>
                  )}
                </td>
                {channels.map((ch) => {
                  const item = preferences.find((p) => p.category === cat && p.channel === ch);
                  if (!item) return <td key={ch} />;

                  return (
                    <td key={ch} className="py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        disabled={item.isLocked}
                        onChange={() => handleToggle(cat, ch, item.enabled, item.isLocked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
