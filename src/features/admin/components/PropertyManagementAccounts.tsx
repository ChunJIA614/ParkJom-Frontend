import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import SystemSelect from '@/components/ui/SystemSelect';
import { apiRequest } from '@/services/apiClient';
import {
  createManagementAccount,
  getManagementInvitationLink,
  listManagementAccounts,
  updateManagementAccount,
} from '@/features/management/api/managementApi';
import { formatFull, parseUtc } from '@/features/management/lib/time';
import {
  MANAGEMENT_ACCOUNT_STATUSES,
  type ManagementAccount,
  type ManagementAccountStatus,
} from '@/features/management/types';

interface PropertyOption {
  propertyId: number;
  propertyName: string;
  address: string;
}

interface PropertyManagementAccountsProps {
  addActivityLog?: (type: string, message: string, user: string) => void;
}

function statusBadge(status: string, mustChangePassword: boolean) {
  const normalized = status.toLowerCase();
  if (normalized === 'suspended' || normalized === 'deactivated') {
    return {
      tone: 'bg-[#fff1f0] dark:bg-red-950/40 text-[#c9342f] dark:text-[#ff6961]',
      icon: XCircle,
      label: status,
    };
  }
  if (mustChangePassword) {
    return {
      tone: 'bg-[#fff8e8] dark:bg-amber-950/40 text-[#a15c00] dark:text-[#ff9f0a]',
      icon: Clock,
      label: 'Invitation Pending',
    };
  }
  return {
    tone: 'bg-[#f0fdf4] dark:bg-emerald-950/40 text-[#248a3d] dark:text-[#30d158]',
    icon: CheckCircle2,
    label: 'Active',
  };
}

export default function PropertyManagementAccounts({ addActivityLog }: PropertyManagementAccountsProps) {
  const { user } = useAuth();
  const token = user?.token ?? '';

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ManagementAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [accounts, setAccounts] = useState<ManagementAccount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
    details?: string;
    invitationLink?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const copyToClipboard = async (text: string, identifier: string | number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(identifier);
    setTimeout(() => {
      setCopiedId((curr) => (curr === identifier ? null : curr));
    }, 2500);
  };

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState<string>('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<ManagementAccount | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPropertyId, setEditPropertyId] = useState('');
  const [editStatus, setEditStatus] = useState<ManagementAccountStatus>('Active');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequest('/property')
      .then((res) => (res.ok ? res.json() : []))
      .then((raw) => {
        if (cancelled || !Array.isArray(raw)) return;
        const mapped: PropertyOption[] = raw
          .filter((item) => item && Number(item.propertyId) > 0)
          .map((item) => ({
            propertyId: Number(item.propertyId),
            propertyName: String(item.propertyName || `Property #${item.propertyId}`),
            address: String(item.address || ''),
          }));
        setProperties(mapped);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listManagementAccounts(token, {
        propertyId: propertyFilter ? Number(propertyFilter) : undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setAccounts(response.data);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load property management accounts.');
    } finally {
      setLoading(false);
    }
  }, [page, propertyFilter, statusFilter, token]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const describeEmailDelivery = (
    account: ManagementAccount,
    action: 'created' | 'updated' | 'resent' = 'updated',
  ) => {
    const status = account.invitationEmailStatus;
    const link = account.invitationLink || undefined;
    const smtpError = account.smtpErrorMessage;

    if (status === 'sent') {
      return {
        tone: 'success' as const,
        text: 'Invitation email dispatched. The manager can open the 14-day link to set their password.',
        invitationLink: link,
      };
    }
    if (status === 'simulated') {
      return {
        tone: 'warning' as const,
        text: 'Account saved, but SMTP is running in simulation mode.',
        details: 'Notifications:Email:Smtp:Host or Password is empty on the backend. You can copy the invitation link below to send directly.',
        invitationLink: link,
      };
    }
    if (status === 'failed') {
      return {
        tone: 'error' as const,
        text: 'Account saved, but SMTP delivery failed.',
        details: smtpError
          ? `Backend SMTP response: ${smtpError}`
          : 'Verify your SMTP credentials/port on the backend and click Resend Invitation.',
        invitationLink: link,
      };
    }
    return {
      tone: 'success' as const,
      text: action === 'created' ? 'Property management account created.' : 'Property management account updated.',
      invitationLink: link,
    };
  };

  const handleCopyAccountLink = async (account: ManagementAccount) => {
    if (account.invitationLink) {
      await copyToClipboard(account.invitationLink, account.managementAccountId);
      return;
    }
    try {
      const result = await getManagementInvitationLink(token, account.managementAccountId);
      if (result.invitationLink) {
        account.invitationLink = result.invitationLink;
        await copyToClipboard(result.invitationLink, account.managementAccountId);
      }
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to generate invitation link.',
      });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const propId = Number(newPropertyId);
    if (!propId || !newEmail.trim() || !newUsername.trim()) {
      setCreateError('Select a property and enter both the manager username and email.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await createManagementAccount(token, {
        propertyId: propId,
        email: newEmail.trim(),
        username: newUsername.trim(),
      });
      setCreateOpen(false);
      setNewEmail('');
      setNewUsername('');
      setNewPropertyId('');
      setFeedback(describeEmailDelivery(created, 'created'));
      addActivityLog?.('users', `Created PropertyManagement account ${created.email} (${created.propertyName})`, 'Admin');
      void loadAccounts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create management account.');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (account: ManagementAccount) => {
    setEditing(account);
    setEditEmail(account.email);
    setEditUsername(account.username);
    setEditPropertyId(String(account.propertyId));
    setEditStatus((account.accountStatus as ManagementAccountStatus) || 'Active');
    setEditError(null);
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateManagementAccount(token, editing.managementAccountId, {
        email: editEmail.trim(),
        username: editUsername.trim(),
        propertyId: Number(editPropertyId),
        status: editStatus,
      });
      setEditing(null);
      setFeedback(describeEmailDelivery(updated, 'updated'));
      addActivityLog?.('users', `Updated PropertyManagement account ${updated.email}`, 'Admin');
      void loadAccounts();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update management account.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResendInvitation = async (account: ManagementAccount) => {
    setFeedback(null);
    try {
      const updated = await updateManagementAccount(token, account.managementAccountId, {
        resendInvitation: true,
      });
      setFeedback(describeEmailDelivery(updated, 'resent'));
      addActivityLog?.('users', `Resent invitation to ${account.email} (${updated.invitationEmailStatus ?? 'sent'})`, 'Admin');
      void loadAccounts();
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to resend invitation link.',
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <section className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Property Management Accounts
            </h2>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa] mt-0.5">
              Provision standalone building-desk accounts and manage 14-day single-use email invitations.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadAccounts()}
              disabled={loading}
              className="min-h-10 px-3.5 rounded-xl border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateError(null); setCreateOpen(true); }}
              className="min-h-10 px-4 rounded-xl bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0066d6] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Invite Property Manager</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="admin-pm-property-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Filter by property
            </label>
            <SystemSelect
              id="admin-pm-property-filter"
              value={propertyFilter}
              onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}
              className="w-full min-h-10 rounded-xl"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.propertyId} value={String(p.propertyId)}>
                  {p.propertyName} (#{p.propertyId})
                </option>
              ))}
            </SystemSelect>
          </div>

          <div>
            <label htmlFor="admin-pm-status-filter" className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1aa] mb-1">
              Filter by account status
            </label>
            <SystemSelect
              id="admin-pm-status-filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as ManagementAccountStatus | ''); setPage(1); }}
              className="w-full min-h-10 rounded-xl"
            >
              <option value="">All statuses</option>
              {MANAGEMENT_ACCOUNT_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </SystemSelect>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-[13px] font-medium transition-all ${
            feedback.tone === 'success'
              ? 'border-[#248a3d]/30 bg-[#f0fdf4] dark:bg-emerald-950/35 text-[#1f6b34] dark:text-[#30d158]'
              : feedback.tone === 'warning'
                ? 'border-[#a15c00]/30 bg-[#fff8e8] dark:bg-amber-950/35 text-[#a15c00] dark:text-[#ff9f0a]'
                : 'border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/35 text-[#c9342f] dark:text-[#ff6961]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold">{feedback.text}</p>
                {feedback.details && (
                  <p className="text-[12px] opacity-90 font-mono break-all font-normal">
                    {feedback.details}
                  </p>
                )}
                {feedback.invitationLink && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(feedback.invitationLink!, 'feedback-banner')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.05] dark:bg-white/[0.1] hover:bg-black/[0.1] dark:hover:bg-white/[0.18] text-[12px] font-semibold text-current transition-colors shadow-xs"
                    >
                      {copiedId === 'feedback-banner' ? (
                        <>
                          <Check size={13} className="text-[#30d158]" />
                          <span className="text-[#30d158]">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Invitation Link</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline shrink-0 mt-0.5 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#c9342f]/30 bg-[#fff1f0] dark:bg-red-950/40 px-4 py-3 text-[12px] font-medium text-[#c9342f] dark:text-[#ff6961] flex items-center gap-2"
        >
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Accounts Table */}
      <section className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#141417] p-5 shadow-sm space-y-4">
        {loading && accounts.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#6e6e73]">
            Loading property management accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Building2 size={28} className="mx-auto text-[#6e6e73]" aria-hidden="true" />
            <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              No property management accounts found
            </p>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
              Invite a building manager to issue their 14-day activation link.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#a1a1aa]">
                  <th className="py-2.5 pr-4">Manager</th>
                  <th className="py-2.5 pr-4">Assigned Property</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Last Sign-In</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.08] text-[13px]">
                {accounts.map((acc) => {
                  const badge = statusBadge(acc.accountStatus, acc.mustChangePassword);
                  const BadgeIcon = badge.icon;
                  return (
                    <tr key={acc.managementAccountId}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{acc.username}</p>
                        <p className="text-[12px] text-[#6e6e73] dark:text-[#a1a1aa] inline-flex items-center gap-1">
                          <Mail size={11} aria-hidden="true" />
                          <span>{acc.email}</span>
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{acc.propertyName}</p>
                        <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1aa]">Property #{acc.propertyId}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                          <BadgeIcon size={12} aria-hidden="true" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#6e6e73] dark:text-[#a1a1aa]">
                        {acc.lastLoginAt ? formatFull(parseUtc(acc.lastLoginAt)) : 'Never signed in'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {acc.mustChangePassword && (
                            <button
                              type="button"
                              onClick={() => void handleCopyAccountLink(acc)}
                              className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                              title="Copy 14-day invitation link to send directly to manager"
                            >
                              {copiedId === acc.managementAccountId ? (
                                <>
                                  <Check size={12} className="text-[#30d158]" aria-hidden="true" />
                                  <span className="text-[#30d158]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} aria-hidden="true" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleResendInvitation(acc)}
                            className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#0071e3] dark:text-[#0a84ff] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <Send size={12} aria-hidden="true" />
                            <span>Resend Invite</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(acc)}
                            className="min-h-9 px-3 rounded-lg border border-black/[0.1] dark:border-white/[0.14] text-[12px] font-semibold inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <Edit3 size={12} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-[12px] text-[#6e6e73]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-9 px-3 rounded-lg border border-black/[0.1] font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Create Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-pm-title"
          className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-black/[0.1] dark:border-white/[0.14] bg-white dark:bg-[#1c1c1e] p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="create-pm-title" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Invite Property Manager
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close dialog"
                className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-[#6e6e73]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div>
              <label htmlFor="new-pm-property" className="block text-[12px] font-semibold mb-1">
                Assigned property
              </label>
              <SystemSelect
                id="new-pm-property"
                value={newPropertyId}
                onChange={(e) => setNewPropertyId(e.target.value)}
                className="w-full min-h-10 rounded-xl"
              >
                <option value="">Select a property…</option>
                {properties.map((p) => (
                  <option key={p.propertyId} value={String(p.propertyId)}>
                    {p.propertyName} (#{p.propertyId})
                  </option>
                ))}
              </SystemSelect>
            </div>

            <div>
              <label htmlFor="new-pm-username" className="block text-[12px] font-semibold mb-1">
                Desk / manager name
              </label>
              <input
                id="new-pm-username"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Sunway Geo Guardhouse"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full min-h-10 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 text-[13px]"
              />
            </div>

            <div>
              <label htmlFor="new-pm-email" className="block text-[12px] font-semibold mb-1">
                Invitation email
              </label>
              <input
                id="new-pm-email"
                type="email"
                required
                maxLength={255}
                placeholder="guardhouse@residence.my"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setCreateError(null); }}
                className="w-full min-h-10 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 text-[13px]"
              />
              <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1aa] mt-1">
                Must be an unassigned email address. Emails currently registered as Commuter, Property Owner, or Admin cannot be invited.
              </p>
            </div>

            {createError && (
              <p role="alert" className="rounded-xl bg-[#fff1f0] p-3 text-[12px] text-[#c9342f]">
                {createError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-10 px-4 rounded-xl border border-black/[0.12] text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="min-h-10 px-4 rounded-xl bg-[#0071e3] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {creating ? 'Sending Invitation…' : 'Create & Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pm-title"
          className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl border border-black/[0.1] dark:border-white/[0.14] bg-white dark:bg-[#1c1c1e] p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="edit-pm-title" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Edit Management Account
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close dialog"
                className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-[#6e6e73]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div>
              <label htmlFor="edit-pm-property" className="block text-[12px] font-semibold mb-1">
                Assigned property
              </label>
              <SystemSelect
                id="edit-pm-property"
                value={editPropertyId}
                onChange={(e) => setEditPropertyId(e.target.value)}
                className="w-full min-h-10 rounded-xl"
              >
                {properties.map((p) => (
                  <option key={p.propertyId} value={String(p.propertyId)}>
                    {p.propertyName} (#{p.propertyId})
                  </option>
                ))}
              </SystemSelect>
            </div>

            <div>
              <label htmlFor="edit-pm-username" className="block text-[12px] font-semibold mb-1">
                Desk / manager name
              </label>
              <input
                id="edit-pm-username"
                type="text"
                required
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full min-h-10 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 text-[13px]"
              />
            </div>

            <div>
              <label htmlFor="edit-pm-email" className="block text-[12px] font-semibold mb-1">
                Email
              </label>
              <input
                id="edit-pm-email"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full min-h-10 rounded-xl border border-black/[0.12] dark:border-white/[0.16] bg-[#f5f5f7] dark:bg-[#2c2c2e] px-3 text-[13px]"
              />
            </div>

            <div>
              <label htmlFor="edit-pm-status" className="block text-[12px] font-semibold mb-1">
                Account status
              </label>
              <SystemSelect
                id="edit-pm-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ManagementAccountStatus)}
                className="w-full min-h-10 rounded-xl"
              >
                {MANAGEMENT_ACCOUNT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </SystemSelect>
            </div>

            {editError && (
              <p role="alert" className="rounded-xl bg-[#fff1f0] p-3 text-[12px] text-[#c9342f]">
                {editError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-10 px-4 rounded-xl border border-black/[0.12] text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-10 px-4 rounded-xl bg-[#0071e3] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
