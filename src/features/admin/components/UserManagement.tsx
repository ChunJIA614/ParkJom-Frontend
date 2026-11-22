import { parseTimestamp, displayDateOptions } from '@/lib/dateTime';
import AdminSummaryCounts from './AdminSummaryCounts';
import AdminPageHeader from './AdminPageHeader';
import SystemSelect from '@/components/ui/SystemSelect';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Gavel,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { showAlert, showConfirm } from '@/components/common/ModalProvider';
import { useAuth } from '@/features/auth/context/AuthContext';
import { adminUpdateUser, getAdminUserDetail, getAllAdminUsers } from '@/features/profile/api/profileApi';
import { reintegrateAccount, suspendAccount } from '../api/accountSuspensionApi';
import { deleteAdminParkingSpot } from '../api/verificationApi';
import { getUserTableRows, type UserTableSort } from '../lib/userTable';
import { mergeProfileIntoSession } from '@/features/profile/lib/session';
import {
  ACCOUNT_STATUSES,
  USER_TYPE_LABELS,
  type AccountStatus,
  type AdminUpdateUserProfileRequest,
  type AdminUserDetail,
  type BackendUserType,
  type UserProfile,
} from '@/features/profile/types';

interface UserManagementProps {
  addActivityLog?: (type: string, message: string, user: string) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];
const SORTABLE_COLUMNS: { column: UserTableSort['column']; label: string; sortLabel?: string }[] = [
  { column: 'id', label: 'User ID' },
  { column: 'name', label: 'Name' },
  { column: 'email', label: 'Email' },
  { column: 'phone', label: 'Phone' },
  { column: 'role', label: 'Role' },
  { column: 'status', label: 'Status' },
  { column: 'bookings', label: 'Bookings', sortLabel: 'Total bookings' },
  { column: 'assets', label: 'Spots / vehicles' },
  { column: 'joined', label: 'Joined' },
];
const userCellClass = 'border-b border-r border-slate-200 dark:border-white/10 px-3 py-3 text-[11px] text-slate-500 dark:text-[#A1A1AA]';

const currency = (value: number) => `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = parseTimestamp(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], displayDateOptions({
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }));
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
  2: 'bg-blue-50 dark:bg-white/[0.06] text-blue-700 dark:text-blue-400 ring-blue-200 dark:ring-blue-800/60',
  3: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 ring-teal-200 dark:ring-teal-800/60',
};

const fieldClass = 'min-h-9 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121214] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-white outline-hidden focus:border-[#007AFF] dark:focus:border-[#0071E3] focus:ring-1 focus:ring-[#007AFF] disabled:bg-slate-50 dark:disabled:bg-white/[0.04] disabled:text-slate-400 dark:disabled:text-[#71717A] transition-colors';

function Avatar({ user, size = 'h-9 w-9' }: { user: Pick<UserProfile, 'profilePictureURL' | 'firstName' | 'email'>; size?: string }) {
  const [failed, setFailed] = useState(false);
  if (user.profilePictureURL && !failed) {
    return <img src={user.profilePictureURL} alt="" onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-white/[0.06] text-xs font-bold text-blue-600 dark:text-[#0A84FF] ring-1 ring-slate-200 dark:ring-white/10`}>
      {(user.firstName?.charAt(0) || user.email.charAt(0) || '?').toUpperCase()}
    </span>
  );
}

export default function UserManagement({ addActivityLog }: UserManagementProps) {
  const { user: currentUser, setUser } = useAuth();
  const token = currentUser?.token ?? '';

  const [search, setSearch] = useState('');
  const [userType, setUserType] = useState<BackendUserType | ''>('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | ''>('');
  const [profileFilter, setProfileFilter] = useState<'' | 'true' | 'false'>('');
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<UserTableSort>({ column: 'joined', direction: 'desc' });
  const listRequest = useRef<AbortController | null>(null);
  const pendingRestriction = useRef(false);
  const [changingUserId, setChangingUserId] = useState<number | null>(null);
  const [restrictionNotice, setRestrictionNotice] = useState<{ message: string; error: boolean } | null>(null);

  const [records, setRecords] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const users = await getAllAdminUsers(token, controller.signal);
      if (!controller.signal.aborted) setRecords(users);
    } catch (loadError) {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setRecords([]);
    setIsLoading(false);
    setError(null);
    void loadUsers();
    return () => listRequest.current?.abort();
  }, [loadUsers]);

  const resetPageAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const matchingUsers = useMemo(() => getUserTableRows(records, {
    search,
    userType,
    accountStatus,
    isProfileComplete: profileFilter === '' ? undefined : profileFilter === 'true',
    sort,
  }), [records, search, userType, accountStatus, profileFilter, sort]);
  const totalCount = matchingUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const users = matchingUsers.slice(offset, offset + pageSize);
  const firstResult = users.length ? offset + 1 : 0;

  useEffect(() => {
    setPage(current => Math.min(current, totalPages));
  }, [totalPages]);
  const lastResult = users.length ? firstResult + users.length - 1 : 0;
  const pageCounts = {
    active: users.filter((entry) => entry.accountStatus.toLowerCase() === 'active').length,
    restricted: users.filter((entry) => entry.accountStatus.toLowerCase() !== 'active').length,
  };

  const SortDirectionIcon = sort.direction === 'asc' ? ArrowUp : ArrowDown;

  function sortBy(column: UserTableSort['column']) {
    setSort(previous => ({
      column,
      direction: previous.column === column && previous.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  async function toggleSuspension(entry: UserProfile) {
    if (!token || pendingRestriction.current || entry.userType === 1 || entry.userId === currentUser?.userId) return;
    const suspended = entry.accountStatus.toLowerCase() === 'suspended';
    const action = suspended ? 'Reinstate' : 'Suspend';
    const ownerNote = entry.userType !== 2 ? '' : suspended
      ? '\n\nTheir suspended parking spots will be restored to Available.'
      : '\n\nTheir available parking spots will be suspended.';
    pendingRestriction.current = true;
    setChangingUserId(entry.userId);
    setRestrictionNotice(null);
    try {
      const confirmed = await showConfirm({
        title: action + ' this account?',
        message: action + ' ' + (entry.fullName || entry.email) + ' (' + entry.email + ').' + ownerNote,
        confirmText: action + ' account',
        cancelText: 'Cancel',
        variant: suspended ? 'warning' : 'danger',
        icon: 'warning',
      });
      if (!confirmed) return;
      const response = await (suspended ? reintegrateAccount : suspendAccount)(token, entry.email);
      const account = response.data;
      setRecords(current => current.map(user => user.userId === account.userId
        ? { ...user, accountStatus: account.accountStatus, updatedAt: account.updatedAt || user.updatedAt }
        : user));
      void loadUsers();
      setRestrictionNotice({ message: response.message || action + ' completed for ' + account.email + '.', error: false });
      addActivityLog?.('governance', (suspended ? 'Reintegrated account: ' : 'Suspended account: ') + account.email, 'Admin');
    } catch (failure) {
      setRestrictionNotice({ message: failure instanceof Error ? failure.message : 'Unable to change account suspension.', error: true });
      void loadUsers();
    } finally {
      pendingRestriction.current = false;
      setChangingUserId(null);
    }
  }

  const handleUserUpdated = (updated: AdminUserDetail, message: string) => {
    setRecords(current => current.map(entry => entry.userId === updated.userId ? updated : entry));
    void loadUsers();
    addActivityLog?.('users', `${message} User #${updated.userId} (${updated.email}).`, 'Admin');
    if (currentUser && updated.userId === currentUser.userId) {
      setUser(mergeProfileIntoSession(currentUser, updated));
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader title="User management" description="Find and manage ParkJom accounts." isLoading={isLoading} onRefresh={loadUsers} />

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span>
          <button type="button" onClick={() => void loadUsers()} disabled={isLoading} className="self-start font-semibold underline underline-offset-2 disabled:opacity-50 sm:self-auto">Try again</button>
        </div>
      )}

      {restrictionNotice && (
        <p role={restrictionNotice.error ? 'alert' : 'status'} className={'rounded-xl border px-4 py-3 text-sm ' + (restrictionNotice.error
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300')}>
          {restrictionNotice.message}
        </p>
      )}

      <AdminSummaryCounts items={[
        { label: 'Matching users', value: totalCount },
        { label: 'Active on page', value: pageCounts.active },
        { label: 'Restricted on page', value: pageCounts.restricted },
      ]} />

      <div className="grid gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] p-3 shadow-sm sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-[#A1A1AA]" />
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search by ID, name, email, or phone" aria-label="Search users"
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

      <label className="block space-y-1 text-xs font-medium text-slate-500 dark:text-[#A1A1AA] md:hidden">
        <span>Sort by</span>
        <SystemSelect aria-label={'Sort users by column, ' + (sort.direction === 'asc' ? 'ascending' : 'descending')}
          value={sort.column} className={fieldClass}
          leadingIcon={<SortDirectionIcon className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
          onChange={event => sortBy(event.target.value as UserTableSort['column'])}>
          {SORTABLE_COLUMNS.map(({ column, label, sortLabel }) => <option key={column} value={column}>{sortLabel ?? label}</option>)}
        </SystemSelect>
      </label>

      {isLoading && users.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500 dark:text-[#A1A1AA]"><Loader2 className="h-4 w-4 animate-spin" /> Loading users</div>
      ) : users.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-[#A1A1AA]"><AlertCircle className="h-7 w-7 text-slate-300 dark:text-[#71717A]" /><p className="text-sm font-semibold text-slate-700 dark:text-white">No users found</p><p className="text-xs text-slate-500 dark:text-[#A1A1AA]">Try a different search or filter.</p></div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${isLoading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table role="table" className="workspace-record-table w-full md:min-w-[1120px] border-separate border-spacing-0 text-left">
              <thead role="rowgroup" className="bg-slate-50 dark:bg-[#18181C] text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]"><tr role="row">
                {SORTABLE_COLUMNS.map(({ column, label, sortLabel = label }, index) => {
                  const current = sort.column === column;
                  const Icon = current ? SortDirectionIcon : ArrowDownUp;
                  return (
                    <th key={column} role="columnheader" scope="col"
                      aria-sort={current ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={'border-b border-r border-slate-200 dark:border-white/10 px-3 py-3 ' + (index === 0 ? 'rounded-tl-2xl' : '')}>
                      <span className="md:hidden">{label}</span>
                      <button type="button" aria-label={'Sort by ' + sortLabel} onClick={() => sortBy(column)}
                        className="hidden items-center gap-1.5 whitespace-nowrap text-left uppercase tracking-wider md:inline-flex hover:text-slate-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer">
                        {label}<Icon className={'size-3 shrink-0 ' + (current ? 'text-blue-600 dark:text-blue-400' : 'opacity-50')} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
                <th role="columnheader" scope="col" className="rounded-tr-2xl border-b border-l border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-[#18181C] md:sticky md:right-0">Actions</th>
              </tr></thead>
              <tbody role="rowgroup">{users.map((entry) => {
                const suspended = entry.accountStatus.toLowerCase() === 'suspended';
                const action = suspended ? 'Reinstate account' : 'Suspend account';
                const canChangeSuspension = entry.userType !== 1 && entry.userId !== currentUser?.userId;
                return (
                  <tr role="row" key={entry.userId} className="group align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors">
                    <td role="cell" data-label="User ID" className={userCellClass + ' font-semibold tabular-nums whitespace-nowrap'}>
                      <span className="mr-1 md:hidden">User ID</span>#{entry.userId}
                    </td>
                    <td role="cell" data-label="Name" className={userCellClass + ' max-md:col-span-full max-md:before:hidden'}>
                      <div className="flex items-center gap-2">
                        <Avatar user={entry} />
                        <p className="min-w-24 text-xs font-semibold text-slate-800 dark:text-white">
                          {entry.fullName || 'Unnamed user'}{currentUser?.userId === entry.userId && <span className="ml-1.5 text-[10px] font-medium text-blue-600 dark:text-[#0A84FF]">(you)</span>}
                        </p>
                      </div>
                    </td>
                    <td role="cell" data-label="Email" className={userCellClass + ' [overflow-wrap:anywhere] md:min-w-36'}>{entry.email}</td>
                    <td role="cell" data-label="Phone" className={userCellClass + ' whitespace-nowrap'}>{entry.phoneNumber || '—'}</td>
                    <td role="cell" data-label="Role" className={userCellClass}>
                      <span className={'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ' + roleTone[entry.userType]}>{USER_TYPE_LABELS[entry.userType]}</span>
                    </td>
                    <td role="cell" data-label="Status" className={userCellClass}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ' + statusTone(entry.accountStatus)}>{entry.accountStatus}</span>
                        {!entry.isProfileComplete && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:ring-orange-800/60">Incomplete profile</span>}
                      </div>
                    </td>
                    <td role="cell" data-label="Bookings" className={userCellClass + ' tabular-nums whitespace-nowrap'}>{entry.summary.totalBookingsCount} total · {entry.summary.activeBookingsCount} active</td>
                    <td role="cell" data-label="Spots / vehicles" className={userCellClass + ' tabular-nums whitespace-nowrap'}>
                      {entry.userType === 2 ? entry.summary.ownedParkingSpotsCount + ' spots' : entry.summary.vehicleCount + ' vehicles'}
                    </td>
                    <td role="cell" data-label="Joined" className={userCellClass + ' whitespace-nowrap'}>{formatDate(entry.createdAt)}</td>
                    <td role="cell" data-label="Actions" className="border-b border-l border-slate-200 bg-white px-3 py-3 group-hover:bg-slate-50 dark:border-white/10 dark:bg-[#141417] dark:group-hover:bg-[#1e1e21] md:sticky md:right-0">
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={changingUserId !== null} onClick={() => setSelectedUserId(entry.userId)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181C] px-3 text-[11px] font-semibold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer">
                          <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-[#0A84FF]" /> Manage
                        </button>
                        {canChangeSuspension && (
                          <button type="button" aria-label={action + ' for ' + (entry.fullName || entry.email)} title={action}
                            disabled={changingUserId !== null || isLoading} onClick={() => void toggleSuspension(entry)}
                            className={'inline-flex min-h-8 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#18181C] cursor-pointer ' + (suspended
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                              : 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40')}>
                            {changingUserId === entry.userId ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <Gavel className="size-4" aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
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
            <button type="button" onClick={() => setPage(page - 1)} disabled={isLoading || page <= 1} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-700 dark:text-white">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={isLoading || page >= totalPages} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#18181C] text-slate-600 dark:text-[#A1A1AA] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
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
                  <p className="rounded-xl bg-blue-50 dark:bg-white/[0.06] border border-blue-100 dark:border-white/10 px-3 py-2 text-[11px] text-blue-700 dark:text-blue-300">This is your own account. Account status is locked to prevent self-lockout.</p>
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
                    {detail.ownedParkingSpots.filter((spot) => spot.status !== 'Deleted').map((spot) => (
                      <li key={spot.parkingSpotId || spot.name} className="flex items-center justify-between gap-3 py-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700 dark:text-white">{spot.name} <span className="font-mono text-[10px] text-slate-400">#{spot.parkingSpotId}</span></p>
                          {spot.address && spot.address !== spot.name && <p className="truncate text-slate-400 dark:text-[#A1A1AA]">{spot.address}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {spot.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(spot.status === 'Available' ? 'active' : spot.status)}`}>{spot.status}</span>}
                          {spot.parkingSpotId > 0 && (
                            <button
                              type="button"
                              disabled={isSaving || spot.status === 'Occupied' || spot.status === 'Reserved'}
                              title={spot.status === 'Occupied' || spot.status === 'Reserved' ? 'Cannot remove parking spot while an active or upcoming booking exists' : 'Remove parking spot'}
                              onClick={async () => {
                                const confirmed = await showConfirm({
                                  title: 'Remove parking spot?',
                                  message: `Are you sure you want to remove "${spot.name}" (Spot #${spot.parkingSpotId})? The system will validate that no active or upcoming commuter booking exists.`,
                                  confirmText: 'Remove spot',
                                  cancelText: 'Cancel',
                                  variant: 'danger',
                                  icon: 'warning',
                                });
                                if (!confirmed) return;
                                try {
                                  const res = await deleteAdminParkingSpot(token, spot.parkingSpotId);
                                  const body = await res.json().catch(() => null) as { success?: boolean; message?: string } | null;
                                  if (!res.ok || body?.success === false) {
                                    void showAlert({
                                      title: 'Cannot remove parking spot',
                                      message: body?.message || 'Unable to remove parking spot due to active or upcoming bookings.',
                                      variant: 'danger',
                                      icon: 'danger',
                                    });
                                    return;
                                  }
                                  void showAlert({
                                    title: 'Parking spot removed',
                                    message: body?.message || `Parking spot #${spot.parkingSpotId} was removed.`,
                                    variant: 'success',
                                    icon: 'success',
                                  });
                                  void load();
                                } catch (err) {
                                  void showAlert({
                                    title: 'Cannot remove parking spot',
                                    message: err instanceof Error ? err.message : 'Unable to remove parking spot.',
                                    variant: 'danger',
                                    icon: 'danger',
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>
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
