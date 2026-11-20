import AdminSummaryCounts from './AdminSummaryCounts';
import AdminPageHeader from './AdminPageHeader';
import SystemSelect from '@/components/ui/SystemSelect';
import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Loader2, RefreshCw, Search, ShieldAlert, User, XCircle } from 'lucide-react';
import type { AccessLogDto, AccessLogPaginationState } from '../types';

interface SystemAuditProps {
  accessLogs: AccessLogDto[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  searchQuery: string;
  pagination: AccessLogPaginationState;
  onSearchChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh: () => void | Promise<void>;
}

type OutcomeFilter = 'all' | 'success' | 'failed';

const getOutcome = (actions: string): Exclude<OutcomeFilter, 'all'> =>
  actions.toLowerCase().includes('[failed]') ? 'failed' : 'success';

const formatAccessTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

const escapeCsvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export default function SystemAudit({
  accessLogs,
  isLoading,
  error,
  totalCount,
  searchQuery,
  pagination,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: SystemAuditProps) {
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const filteredLogs = useMemo(() => accessLogs.filter((log) => {
    const matchesOutcome = outcomeFilter === 'all' || getOutcome(log.actions) === outcomeFilter;
    return matchesOutcome;
  }), [accessLogs, outcomeFilter]);
  const visibleLogs = pagination.source === 'client'
    ? filteredLogs.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
    : filteredLogs;
  const effectiveTotalCount = pagination.source === 'client' ? filteredLogs.length : totalCount;
  const effectiveTotalPages = pagination.source === 'client'
    ? Math.max(1, Math.ceil(filteredLogs.length / pagination.pageSize))
    : pagination.totalPages;
  const effectiveHasNextPage = pagination.page < effectiveTotalPages;

  const successCount = accessLogs.filter((log) => getOutcome(log.actions) === 'success').length;
  const failedCount = accessLogs.filter((log) => getOutcome(log.actions) === 'failed').length;
  const systemCount = accessLogs.filter((log) => log.userId === null).length;

  const exportLogs = () => {
    const header = ['Access Log ID', 'Action', 'Outcome', 'Accessed At', 'User ID', 'User Name', 'User Email', 'Booking ID', 'IoT Device ID'];
    const rows = visibleLogs.map((log) => [
      log.accessLogId,
      log.actions,
      getOutcome(log.actions),
      log.accessedAt,
      log.userId,
      log.userName,
      log.userEmail,
      log.bookingId,
      log.ioTDeviceId,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `parkjom-access-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const firstResult = visibleLogs.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastResult = visibleLogs.length === 0 ? 0 : firstResult + visibleLogs.length - 1;

  return (
    <div id="system-audit-root" className="space-y-5">
      <AdminPageHeader headingId="audit-title" title="System access logs" description="Review account, vehicle, wallet, and parking events." isLoading={isLoading} onRefresh={onRefresh}>
        <button type="button" onClick={exportLogs} disabled={visibleLogs.length === 0} className="workspace-button workspace-button--secondary">
          <Download size={15} aria-hidden="true" /> Export CSV
        </button>
      </AdminPageHeader>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={onRefresh} className="self-start font-semibold underline underline-offset-2 sm:self-auto">Try again</button>
        </div>
      )}

      <AdminSummaryCounts items={[
        { label: 'Total events', value: totalCount },
        { label: 'Successful', value: successCount },
        { label: 'Failed', value: failedCount },
        { label: 'System events', value: systemCount },
      ]} />

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex self-start rounded-lg bg-slate-100 p-1">
            {(['all', 'success', 'failed'] as OutcomeFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => { setOutcomeFilter(filter); onPageChange(1); }} aria-pressed={outcomeFilter === filter}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${outcomeFilter === filter ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {filter}
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search actions, users, or IDs"
              className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </label>
        </div>
      </div>

      {isLoading && accessLogs.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading access logs
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-slate-500">
          <AlertCircle className="h-7 w-7 text-slate-300" />
          <p className="text-sm font-semibold">No matching access logs</p>
        </div>
      ) : (
        <div className="isolate overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table role="table" className="workspace-record-table w-full min-w-[780px] border-separate border-spacing-0 text-left">
              <thead role="rowgroup" className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                <tr role="row">
                  <th role="columnheader" scope="col" className="rounded-tl-[11px] border-b-2 border-r border-slate-200 px-4 py-3">Event</th>
                  <th role="columnheader" scope="col" className="border-b-2 border-r border-slate-200 px-4 py-3">Actor</th>
                  <th role="columnheader" scope="col" className="border-b-2 border-r border-slate-200 px-4 py-3">References</th>
                  <th role="columnheader" scope="col" className="rounded-tr-[11px] border-b-2 border-slate-200 px-4 py-3">Accessed</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-200">
                {visibleLogs.map((log) => {
                  const outcome = getOutcome(log.actions);
                  return (
                    <tr role="row" key={log.accessLogId} className="align-top hover:bg-slate-50/70">
                      <td role="cell" data-label="Event" className="relative border-r border-slate-200 px-4 py-3">
                        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${outcome === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <div className="flex items-start gap-2">
                          {outcome === 'success'
                            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{log.actions}</p>
                            <p className="mt-1 font-mono text-[10px] text-slate-400">Log #{log.accessLogId}</p>
                          </div>
                        </div>
                      </td>
                      <td role="cell" data-label="Actor" className="border-r border-slate-200 px-4 py-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">{log.userName || 'System'}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{log.userEmail || 'No user email'}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">User {log.userId ?? 'system'}</p>
                      </td>
                      <td role="cell" data-label="References" className="border-r border-slate-200 px-4 py-3 font-mono text-[10px] text-slate-500">
                        <p>Booking: {log.bookingId ?? '-'}</p>
                        <p className="mt-1">IoT device: {log.ioTDeviceId ?? '-'}</p>
                      </td>
                      <td role="cell" data-label="Accessed" className="px-4 py-3 text-xs text-slate-600">
                        <p className="whitespace-nowrap">{formatAccessTime(log.accessedAt)}</p>
                        <p className="mt-1 text-[10px] text-slate-400">Created {formatAccessTime(log.createdAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="text-[11px] text-slate-500" aria-live="polite">
          Showing <span className="font-semibold text-slate-700">{firstResult}-{Math.min(lastResult, effectiveTotalCount)}</span> of <span className="font-semibold text-slate-700">{effectiveTotalCount}</span> logs
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Rows per page
            <SystemSelect
              value={pagination.pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={isLoading}
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Audit logs rows per page"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </SystemSelect>
          </label>
          <nav className="flex items-center gap-1" aria-label="Audit log pagination">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={isLoading || pagination.page <= 1}
              title="First page"
              aria-label="First page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={isLoading || pagination.page <= 1}
              title="Previous page"
              aria-label="Previous page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 text-center text-xs font-semibold text-slate-700">
              Page {pagination.page} of {effectiveTotalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={isLoading || !effectiveHasNextPage}
              title="Next page"
              aria-label="Next page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(effectiveTotalPages)}
              disabled={isLoading || pagination.page >= effectiveTotalPages}
              title="Last page"
              aria-label="Last page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
