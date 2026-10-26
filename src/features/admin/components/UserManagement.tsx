import SystemSelect from '@/components/ui/SystemSelect';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { showAlert, showConfirm } from '@/contexts/ModalContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { adminUpdateUser, getAdminUserDetail, getAdminUsers } from '@/features/profile/api/profileApi';
import { mergeProfileIntoSession } from '@/features/profile/lib/session';
import {
  ACCOUNT_STATUSES,
  USER_TYPE_LABELS,
  type AccountStatus,
  type AdminUpdateUserProfileRequest,
  type AdminUserDetail,
  type AdminUserListResult,
  type BackendUserType,
  type UserProfile,
} from '@/features/profile/types';

interface UserManagementProps {
  addActivityLog?: (type: string, message: string, user: string) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

const currency = (value: number) => `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const statusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800/60';
    case 'suspended': return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800/60';
    case 'deactivated': return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 ring-slate-200 dark:ring-zinc-700';
    default: return 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 ring-slate-200 dark:ring-zinc-700';
  }
};

const roleTone: Record<BackendUserType, string> = {
  1: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 ring-violet-200 dark:ring-violet-800/60',
  2: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 ring-blue-200 dark:ring-blue-800/60',
  3: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 ring-teal-200 dark:ring-teal-800/60',
};

const fieldClass = 'min-h-9 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF] disabled:bg-slate-50 dark:disabled:bg-white/[0.04] disabled:text-slate-400 dark:disabled:text-[#71717A] transition-colors';

function Avatar({ user, size = 'h-9 w-9' }: { user: Pick<UserProfile, 'profilePictureURL' | 'firstName' | 'email'>; size?: string }) {
  const [failed, setFailed] = useState(false);
  if (user.profilePictureURL && !failed) {
    return <img src={user.profilePictureURL} alt="" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-xs font-bold text-blue-600 dark:text-[#0A84FF] ring-1 ring-slate-200 dark:ring-white/10`}>
      {(user.firstName?.charAt(0) || user.email.charAt(0) || '?').toUpperCase()}
    </span>
  );
}

export default function UserManagement({ addActivityLog }: UserManagementProps) {
  const { user: currentUser, setUser } = useAuth();
  const token = currentUser?.token ?? '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userType, setUserType] = useState<BackendUserType | ''>('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | ''>('');
  const [profileFilter, setProfileFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [result, setResult] = useState<AdminUserListResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAdminUsers(token, {
        search: debouncedSearch,
        userType: userType || undefined,
        accountStatus: accountStatus || undefined,
        isProfileComplete: profileFilter === '' ? undefined : profileFilter === 'true',
        page,
        pageSize,
      });
      setResult(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [accountStatus, debouncedSearch, page, pageSize, profileFilter, token, userType]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetPageAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const users = result?.users ?? [];
  const totalCount = result?.totalCount ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const firstResult = users.length ? (page - 1) * pageSize + 1 : 0;
  const lastResult = users.length ? firstResult + users.length - 1 : 0;
  const pageCounts = {
    active: users.filter((entry) => entry.accountStatus.toLowerCase() === 'active').length,
    restricted: users.filter((entry) => entry.accountStatus.toLowerCase() !== 'active').length,
  };

  const handleUserUpdated = (updated: AdminUserDetail, message: string) => {
    setResult((current) => current ? {
      ...current,
      users: current.users.map((entry) => entry.userId === updated.userId ? { ...entry, ...updated, summary: updated.summary } : entry),
    } : current);
    addActivityLog?.('users', `${message} User #${updated.userId} (${updated.email}).`, 'Admin');
    if (currentUser && updated.userId === currentUser.userId) {
      setUser(mergeProfileIntoSession(currentUser, updated));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">User Management</h2>
          <p className="text-sm text-slate-500 dark:text-[#A1A1AA]">Search, inspect, and govern every ParkJom account.</p>
        </div>
        <button type="button" onClick={() => void loadUsers()} disabled={isLoading}
          className="inline-flex min-h-9 items-center gap-2 self-start rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3.5 text-xs font-semibold text-slate-700 dark:text-white shadow-xs hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button type="button" onClick={() => void loadUsers()} disabled={isLoading} className="self-start font-semibold underline underline-offset-2 disabled:opacity-50 sm:self-auto">Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">Matching users</span><Users className="h-4 w-4 text-blue-600 dark:text-[#0A84FF]" /></div>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">Active on page</span><ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{pageCounts.active}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">Restricted on page</span><AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /></div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{pageCounts.restricted}</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3 shadow-sm sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[#A1A1AA]" />
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search name, email, or phone" aria-label="Search users"
            className="min-h-9 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121214] pl-9 pr-3 text-xs text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#71717A] outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF] transition-colors" />
        </label>
        <SystemSelect aria-label="Filter by role" value={userType} onChange={(event) => resetPageAnd(setUserType)(event.target.value ? Number(event.target.value) as BackendUserType : '')} className={fieldClass}>
          <option value="">All roles</option>
          <option value={1}>Admin</option>
          <option value={2}>Property Owner</option>
          <option value={3}>Commuter</option>
        </SystemSelect>
        <SystemSelect aria-label="Filter by account status" value={accountStatus} onChange={(event) => resetPageAnd(setAccountStatus)(event.target.value as AccountStatus | '')} className={fieldClass}>
          <option value="">All statuses</option>
          {ACCOUNT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </SystemSelect>
        <SystemSelect aria-label="Filter by profile completion" value={profileFilter} onChange={(event) => resetPageAnd(setProfileFilter)(event.target.value as '' | 'true' | 'false')} className={fieldClass}>
          <option value="">Any profile</option>
          <option value="true">Complete</option>
          <option value="false">Incomplete</option>
        </SystemSelect>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500 dark:text-[#A1A1AA]"><Loader2 className="h-4 w-4 animate-spin" /> Loading users</div>
      ) : users.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-[#A1A1AA]"><AlertCircle className="h-7 w-7 text-slate-300 dark:text-[#71717A]" /><p className="text-sm font-semibold text-slate-700 dark:text-white">No users found</p><p className="text-xs text-slate-500 dark:text-[#A1A1AA]">Try a different search or filter.</p></div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${isLoading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
              <thead className="bg-slate-50 dark:bg-[#18181C] text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]"><tr>
                <th className="rounded-tl-2xl border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">User</th>
                <th className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">Role &amp; status</th>
                <th className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">Activity</th>
                <th className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">Joined</th>
                <th className="rounded-tr-2xl border-b border-slate-200 dark:border-white/10 px-4 py-3">Actions</th>
              </tr></thead>
              <tbody>{users.map((entry) => (
                <tr key={entry.userId} className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors">
                  <td className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={entry} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800 dark:text-white">{entry.fullName || 'Unnamed user'}{currentUser?.userId === entry.userId && <span className="ml-1.5 text-[10px] font-medium text-blue-600 dark:text-[#0A84FF]">(you)</span>}</p>
                        <p className="truncate text-[10px] text-slate-500 dark:text-[#A1A1AA]">{entry.email}</p>
                        <p className="truncate text-[10px] text-slate-400 dark:text-[#71717A]">{entry.phoneNumber || 'No phone'} · #{entry.userId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleTone[entry.userType]}`}>{USER_TYPE_LABELS[entry.userType]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(entry.accountStatus)}`}>{entry.accountStatus}</span>
                      {!entry.isProfileComplete && <span className="rounded-full bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/60">Incomplete</span>}
                    </div>
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3 text-[10px] text-slate-500 dark:text-[#A1A1AA]">
                    <p><span className="font-semibold text-slate-700 dark:text-white">{currency(entry.summary.walletBalance)}</span> wallet</p>
                    <p className="mt-0.5">{entry.summary.activeBookingsCount} active · {entry.summary.totalBookingsCount} total bookings</p>
                    <p className="mt-0.5">{entry.userType === 2 ? `${entry.summary.ownedParkingSpotsCount} spots` : `${entry.summary.vehicleCount} vehicles`} · {entry.summary.openSupportTicketsCount} open tickets</p>
                  </td>
                  <td className="border-b border-r border-slate-200 dark:border-white/10 px-4 py-3 text-[10px] text-slate-500 dark:text-[#A1A1AA] whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                  <td className="border-b border-slate-200 dark:border-white/10 px-4 py-3">
                    <button type="button" onClick={() => setSelectedUserId(entry.userId)}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 text-[11px] font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                      <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-[#0A84FF]" /> Manage
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">Showing <span className="font-semibold text-slate-700 dark:text-white">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700 dark:text-white">{totalCount}</span> users</p>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">Rows per page
            <SystemSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#121214] px-2 text-xs font-semibold text-slate-700 dark:text-white outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF]" aria-label="Users rows per page">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </SystemSelect>
          </label>
          <nav className="flex items-center gap-1" aria-label="User pagination">
            <button type="button" onClick={() => setPage(1)} disabled={isLoading || page <= 1} aria-label="First page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronsLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={isLoading || page <= 1} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-700 dark:text-white">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={isLoading || page >= totalPages} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={isLoading || page >= totalPages} aria-label="Last page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronsRight className="h-4 w-4" /></button>
          </nav>
        </div>
      </div>

      {selectedUserId !== null && (
        <UserDetailPanel
          token={token}
          userId={selectedUserId}
          isSelf={currentUser?.userId === selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdated={handleUserUpdated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail + edit panel
// ---------------------------------------------------------------------------

interface UserDetailPanelProps {
  token: string;
  userId: number;
  isSelf: boolean;
  onClose: () => void;
  onUpdated: (user: AdminUserDetail, message: string) => void;
}

interface EditForm {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userType: BackendUserType;
  isProfileComplete: boolean;
  accountStatus: AccountStatus;
}

const toAccountStatus = (value: string): AccountStatus =>
  ACCOUNT_STATUSES.find((status) => status.toLowerCase() === value.toLowerCase()) ?? 'Active';

const formFromDetail = (detail: AdminUserDetail): EditForm => ({
  firstName: detail.firstName,
  lastName: detail.lastName,
  phoneNumber: detail.phoneNumber,
  userType: detail.userType,
  isProfileComplete: detail.isProfileComplete,
  accountStatus: toAccountStatus(detail.accountStatus),
});

function UserDetailPanel({ token, userId, isSelf, onClose, onUpdated }: UserDetailPanelProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAdminUserDetail(token, userId);
      setDetail(response);
      setForm(formFromDetail(response));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this user.');
    } finally {
      setIsLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const buildChanges = (): AdminUpdateUserProfileRequest => {
    if (!detail || !form) return {};
    const changes: AdminUpdateUserProfileRequest = {};
    if (form.firstName.trim() !== detail.firstName) changes.firstName = form.firstName.trim();
    if (form.lastName.trim() !== detail.lastName) changes.lastName = form.lastName.trim();
    if (form.phoneNumber.trim() !== detail.phoneNumber) changes.phoneNumber = form.phoneNumber.trim();
    // User roles are strictly permanent and cannot be changed by anyone
    if (form.isProfileComplete !== detail.isProfileComplete) changes.isProfileComplete = form.isProfileComplete;
    if (form.accountStatus !== toAccountStatus(detail.accountStatus)) changes.accountStatus = form.accountStatus;
    return changes;
  };

  const changes = buildChanges();
  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !hasChanges) return;

    if (changes.accountStatus) {
      const ownerNote = detail.userType === 2 && changes.accountStatus
        ? changes.accountStatus === 'Active'
          ? '\n\nTheir suspended parking spots will be restored to Available.'
          : '\n\nAll of their parking spots will be suspended.'
        : '';
      const confirmed = await showConfirm({
        title: 'Confirm account status change',
        message: `You are about to set account status to ${changes.accountStatus} for ${detail.fullName || detail.email}.${ownerNote}`,
        confirmText: 'Apply status change',
        variant: changes.accountStatus !== 'Active' ? 'danger' : 'warning',
        icon: 'warning',
      });
      if (!confirmed) return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await adminUpdateUser(token, detail.userId, changes);
      // Keep fields the update response may omit (vehicles/spots/googleId).
      const merged: AdminUserDetail = {
        ...detail,
        ...response.user,
        userId: response.user.userId || detail.userId,
        email: response.user.email || detail.email,
        googleId: response.user.googleId ?? detail.googleId,
        vehicles: response.user.vehicles.length ? response.user.vehicles : detail.vehicles,
        ownedParkingSpots: response.user.ownedParkingSpots.length ? response.user.ownedParkingSpots : detail.ownedParkingSpots,
      };
      setDetail(merged);
      setForm(formFromDetail(merged));
      onUpdated(merged, response.message);
      void showAlert({ title: 'User updated', message: response.message, variant: 'success', icon: 'success' });
      // Re-fetch so derived data (e.g. owner spot statuses) reflects the backend sync.
      void load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this user.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="admin-drawer-portal fixed inset-0 z-[100] flex justify-end bg-black/50 dark:bg-black/70 backdrop-blur-xs">
      <button type="button" aria-label="Close user details" className="absolute inset-0 cursor-default" onClick={() => !isSaving && onClose()} />
      <aside role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title" className="admin-drawer-panel relative flex h-full w-full max-w-xl flex-col bg-slate-50 dark:bg-[#121214] border-l border-slate-200 dark:border-white/10 shadow-2xl animate-in slide-in-from-right duration-200 z-10">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h3 id="admin-user-detail-title" className="text-base font-bold text-slate-800 dark:text-white">User #{userId}</h3>
            <p className="truncate text-xs text-slate-500 dark:text-[#A1A1AA]">{detail?.email ?? 'Loading…'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close" className="rounded-lg p-2 text-slate-500 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
              {!detail && <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>}
            </div>
          )}

          {isLoading && !detail ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500 dark:text-[#A1A1AA]"><Loader2 className="h-4 w-4 animate-spin" /> Loading user</div>
          ) : detail && form && (
            <>
              <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar user={detail} size="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{detail.fullName || 'Unnamed user'}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleTone[detail.userType]}`}>{USER_TYPE_LABELS[detail.userType] || (detail.roleName === 'Renter' ? 'Commuter' : detail.roleName) || 'Commuter'}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(detail.accountStatus)}`}>{detail.accountStatus}</span>
                    </div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                  <dt className="text-slate-400 dark:text-[#A1A1AA]">Google ID</dt><dd className="truncate font-mono text-slate-700 dark:text-white">{detail.googleId || '—'}</dd>
                  <dt className="text-slate-400 dark:text-[#A1A1AA]">Created</dt><dd className="text-slate-700 dark:text-white">{formatDate(detail.createdAt)}</dd>
                  <dt className="text-slate-400 dark:text-[#A1A1AA]">Updated</dt><dd className="text-slate-700 dark:text-white">{formatDate(detail.updatedAt)}</dd>
                  {detail.lastLoginAt && <><dt className="text-slate-400 dark:text-[#A1A1AA]">Last login</dt><dd className="text-slate-700 dark:text-white">{formatDate(detail.lastLoginAt)}</dd></>}
                </dl>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]"><span>Wallet</span><Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-[#0A84FF]" /></div>
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{currency(detail.summary.walletBalance)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#A1A1AA]">{currency(detail.summary.walletOnHold)} on hold</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]"><span>Bookings</span><UserRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></div>
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{detail.summary.activeBookingsCount} <span className="text-xs font-medium text-slate-400 dark:text-[#A1A1AA]">active</span></p>
                  <p className="text-[10px] text-slate-400 dark:text-[#A1A1AA]">{detail.summary.totalBookingsCount} total · {detail.summary.openSupportTicketsCount} open tickets</p>
                </div>
              </section>

              <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">Edit profile</h4>
                {isSelf && (
                  <p className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-300">This is your own account. Account status is locked to prevent self-lockout.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">First name</span>
                    <input className={fieldClass} value={form.firstName} maxLength={100} disabled={isSaving} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                  </label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">Last name</span>
                    <input className={fieldClass} value={form.lastName} maxLength={100} disabled={isSaving} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
                  </label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">Phone number</span>
                    <input className={fieldClass} type="tel" value={form.phoneNumber} maxLength={20} disabled={isSaving} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} />
                  </label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">Role</span>
                    <input
                      className={`${fieldClass} cursor-not-allowed bg-slate-50 dark:bg-white/[0.04] font-medium text-slate-700 dark:text-[#A1A1AA]`}
                      value={USER_TYPE_LABELS[detail.userType] || (detail.roleName === 'Renter' ? 'Commuter' : detail.roleName) || 'Commuter'}
                      disabled
                      readOnly
                      title="Role cannot be changed"
                    />
                  </label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA]">Account status</span>
                    <SystemSelect className={fieldClass} value={form.accountStatus} disabled={isSaving || isSelf} onChange={(event) => setForm({ ...form, accountStatus: event.target.value as AccountStatus })}>
                      {ACCOUNT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </SystemSelect>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-[11px] font-semibold text-slate-600 dark:text-[#A1A1AA] cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-[#121214] accent-[#007AFF] dark:accent-[#0A84FF]" checked={form.isProfileComplete} disabled={isSaving}
                      onChange={(event) => setForm({ ...form, isProfileComplete: event.target.checked })} />
                    Profile complete
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" disabled={!hasChanges || isSaving} onClick={() => setForm(formFromDetail(detail))}
                    className="min-h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 cursor-pointer">Reset</button>
                  <button type="submit" disabled={!hasChanges || isSaving}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-600 dark:bg-[#0071E3] px-4 text-xs font-semibold text-white hover:bg-blue-700 dark:hover:bg-[#0077ED] shadow-sm transition-colors disabled:opacity-40 cursor-pointer">
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes
                  </button>
                </div>
              </form>

              <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]"><Car className="h-3.5 w-3.5" /> Vehicles ({detail.vehicles.length})</h4>
                {detail.vehicles.length === 0 ? <p className="mt-2 text-[11px] text-slate-400 dark:text-[#71717A]">No registered vehicles.</p> : (
                  <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {detail.vehicles.map((vehicle) => (
                      <li key={vehicle.vehicleId || vehicle.numberPlate} className="flex items-center justify-between py-2 text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-white">{vehicle.numberPlate || `Vehicle #${vehicle.vehicleId}`}</span>
                        <span className="text-slate-500 dark:text-[#A1A1AA]">{[vehicle.vehicleBrand, vehicle.vehicleModel, vehicle.vehicleColor].filter(Boolean).join(' · ') || '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-4 shadow-sm">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]"><Building2 className="h-3.5 w-3.5" /> Owned parking spots ({detail.ownedParkingSpots.length})</h4>
                {detail.ownedParkingSpots.length === 0 ? <p className="mt-2 text-[11px] text-slate-400 dark:text-[#71717A]">No owned parking spots.</p> : (
                  <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {detail.ownedParkingSpots.map((spot) => (
                      <li key={spot.parkingSpotId || spot.name} className="flex items-start justify-between gap-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700 dark:text-white">{spot.name}</p>
                          {spot.address && spot.address !== spot.name && <p className="truncate text-slate-400 dark:text-[#A1A1AA]">{spot.address}</p>}
                        </div>
                        {spot.status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(spot.status === 'Available' ? 'active' : spot.status)}`}>{spot.status}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
