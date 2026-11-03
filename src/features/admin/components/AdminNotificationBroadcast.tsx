import React, { useState, useEffect } from 'react';
import {
  Send,
  Radio,
  Users,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Clock,
  ShieldAlert,
  Mail,
  Smartphone,
  Globe,
} from 'lucide-react';
import {
  sendAdminBroadcast,
  fetchAdminDeliveries,
  AdminBroadcastRequest,
  DeliveryStatusRecord,
  NotificationPriority,
} from '@/features/notifications';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function AdminNotificationBroadcast() {
  const { user } = useAuth();
  const token = user?.token ?? '';

  const [activeTab, setActiveTab] = useState<'broadcast' | 'audit'>('broadcast');

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<'Renter' | 'PropertyOwner' | ''>('');
  const [priority, setPriority] = useState<NotificationPriority>('Normal');
  const [actionUrl, setActionUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Deliveries audit state
  const [deliveries, setDeliveries] = useState<DeliveryStatusRecord[]>([]);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<string>('');

  const loadDeliveries = async () => {
    if (!token) return;
    try {
      setIsLoadingDeliveries(true);
      const data = await fetchAdminDeliveries(token, deliveryFilter || undefined, 50);
      setDeliveries(data);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadDeliveries();
    }
  }, [activeTab, deliveryFilter]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim() || !body.trim()) return;

    try {
      setIsSending(true);
      setSendResult(null);

      const req: AdminBroadcastRequest = {
        title: title.trim(),
        body: body.trim(),
        targetRole: targetRole || undefined,
        priority,
        actionUrl: actionUrl.trim() || undefined,
        type: priority === 'Critical' ? 'system.alert' : 'system.announcement',
      };

      const res = await sendAdminBroadcast(token, req);
      setSendResult({
        success: true,
        message: res.message,
        count: res.recipientCount,
      });

      // Clear form on success
      setTitle('');
      setBody('');
      setActionUrl('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send broadcast.';
      setSendResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2">
            <Radio size={20} className="text-emerald-500" /> Platform Broadcast & Notifications
          </h2>
          <p className="text-xs text-[#6e6e73] dark:text-[#a1a1aa] mt-0.5">
            Send real-time alerts, maintenance notices, and monitor outbox delivery status.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-white dark:bg-[#18181c] text-[#1d1d1f] dark:text-white shadow-sm'
                : 'text-[#6e6e73] dark:text-[#a1a1aa] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            Create Broadcast
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-[#18181c] text-[#1d1d1f] dark:text-white shadow-sm'
                : 'text-[#6e6e73] dark:text-[#a1a1aa] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            Delivery Audit Log
          </button>
        </div>
      </div>

      {/* Broadcast Tab */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSend}
            className="lg:col-span-2 space-y-4 rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#18181c] p-6 shadow-sm"
          >
            <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-white">Compose Announcement</h3>

            {sendResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  sendResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                {sendResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{sendResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
                  Target Audience
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as 'Renter' | 'PropertyOwner' | '')}
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2 text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Platform Users (Commuters + Owners)</option>
                  <option value="Renter">Commuters Only</option>
                  <option value="PropertyOwner">Parking Spot Owners Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
                  Urgency / Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2 text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Normal">Normal (Standard App Banner)</option>
                  <option value="High">High (Elevated Visibility)</option>
                  <option value="Critical">Critical (Emergency / Service Alert)</option>
                  <option value="Low">Low (Informational)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
                Notification Title *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Scheduled System Maintenance Notice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2.5 text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
                Notification Message *
              </label>
              <textarea
                required
                rows={4}
                maxLength={500}
                placeholder="Write your broadcast announcement details here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2.5 text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
                Action URL (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. /home or /commuter"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2.5 text-xs text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !body.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>{isSending ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
              </button>
            </div>
          </form>

          {/* Quick Preview Card */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#18181c] p-5 shadow-sm">
              <h4 className="text-xs font-bold text-[#6e6e73] dark:text-[#a1a1aa] uppercase tracking-wider mb-3">
                Live Commuter Preview
              </h4>
              <div className="rounded-xl border border-black/[0.06] dark:border-white/10 bg-[#f9f9fb] dark:bg-[#121214] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                    System Broadcast
                  </span>
                  <span className="text-[10px] text-[#8e8e93]">Just now</span>
                </div>
                <p className="text-xs font-bold text-[#1d1d1f] dark:text-white">
                  {title || 'Your Announcement Title'}
                </p>
                <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1aa] line-clamp-3">
                  {body || 'Broadcast body will appear here in the user notification drawer and push preview.'}
                </p>
                {actionUrl && (
                  <p className="text-[10px] text-blue-500 underline truncate">
                    Tap to open: {actionUrl}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Real-Time Zero Delay
              </p>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Broadcasts stream via WebSockets/SignalR directly to online commuters and owners, and queue for instant push delivery.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4 rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#18181c] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-white">Delivery Dispatch Log</h3>
              <button
                type="button"
                onClick={loadDeliveries}
                disabled={isLoadingDeliveries}
                className="p-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#6e6e73] dark:text-[#a1a1aa] transition-colors cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw size={14} className={isLoadingDeliveries ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6e6e73] dark:text-[#a1a1aa]">Filter Status:</span>
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#121214] px-2.5 py-1 text-xs text-[#1d1d1f] dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="Sent">Sent (Success)</option>
                <option value="Pending">Pending / Retrying</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>

          {isLoadingDeliveries && deliveries.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8e8e93] dark:text-[#71717a]">
              Loading delivery audit records...
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8e8e93] dark:text-[#71717a]">
              No delivery records found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/10 text-[#6e6e73] dark:text-[#a1a1aa]">
                    <th className="py-2.5 px-3">Delivery ID</th>
                    <th className="py-2.5 px-3">Notification #</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Attempts</th>
                    <th className="py-2.5 px-3">Dispatched / Sent</th>
                    <th className="py-2.5 px-3">Notes / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {deliveries.map((d) => (
                    <tr key={d.deliveryId} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono text-[#8e8e93]">#{d.deliveryId}</td>
                      <td className="py-2.5 px-3 font-mono">#{d.notificationId}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {d.channel === 'InApp' && <Smartphone size={12} className="text-blue-500" />}
                          {d.channel === 'Email' && <Mail size={12} className="text-amber-500" />}
                          {d.channel === 'WebPush' && <Globe size={12} className="text-emerald-500" />}
                          {d.channel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            d.status === 'Sent'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : d.status === 'Failed'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{d.attemptCount}</td>
                      <td className="py-2.5 px-3 text-[#8e8e93]">
                        {d.sentAt ? new Date(d.sentAt).toLocaleString() : 'Pending'}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-[#8e8e93]" title={d.lastError || ''}>
                        {d.lastError || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
