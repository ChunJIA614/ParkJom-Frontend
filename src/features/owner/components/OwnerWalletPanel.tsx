import { parseTimestamp, displayDateOptions } from '@/lib/dateTime';
import WorkspaceActivityRow from '@/components/ui/WorkspaceActivityRow';
import WorkspaceEmptyState from '@/components/ui/WorkspaceEmptyState';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  Clock3,
  CircleHelp,
  Loader2,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import {
  getOwnerEarningsSummary,
  getOwnerEarningsTransactions,
  requestOwnerWithdrawal,
  type OwnerEarningsTransactionsParams,
} from '../api/earningsApi';
import type { OwnerEarningsSummary, OwnerEarningsTransactionItem } from '../types';
import SystemSelect from '@/components/ui/SystemSelect';

interface Props {
  token: string;
  activeBank?: { name: string; accNo: string; holder: string };
  onNavigateSettings?: () => void;
}

const PAGE_SIZE = 5;

const TRANSACTION_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All transactions' },
  { value: 'payout', label: 'Payouts' },
  { value: 'commission', label: 'Platform commission' },
  { value: 'cancellation', label: 'Cancellations' },
  { value: 'penalty', label: 'Overstay penalties' },
];

function money(value: number | null | undefined): string {
  return `RM ${(Number.isFinite(value as number) ? Number(value) : 0).toFixed(2)}`;
}

function formatDate(value: string): string {
  if (!value) return '-';
  const dateOnly = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-MY', displayDateOptions({ day: 'numeric', month: 'short', year: 'numeric' }, Boolean(dateOnly))).format(date);
}

function StatCard({
  label,
  value,
  hint,
  tone,
  featured = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'emerald' | 'amber' | 'slate' | 'blue';
  featured?: boolean;
}) {
  const tones = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    slate: 'text-slate-700 dark:text-white',
    blue: 'text-blue-700 dark:text-blue-400',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${featured
      ? 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
      : 'border-slate-100 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-[#A1A1AA]">{label}</p>
        <details className="relative shrink-0">
          <summary
            aria-label={`About ${label.toLowerCase()}`}
            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-white/10 dark:hover:text-white [&::-webkit-details-marker]:hidden"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </summary>
          <p className="absolute right-0 top-10 z-10 w-52 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg dark:border-white/10 dark:bg-[#242428] dark:text-slate-300">
            {hint}
          </p>
        </details>
      </div>
      <p className={`mt-2 break-words font-extrabold tracking-tight tabular-nums ${featured ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'} ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function TransactionRow({ item }: { item: OwnerEarningsTransactionItem }) {
  const extras = [
    item.commission > 0 ? { label: 'Commission', amount: item.commission } : null,
    item.penalty > 0 ? { label: 'Penalty', amount: item.penalty } : null,
    item.cancellation > 0 ? { label: 'Refund', amount: item.cancellation } : null,
  ].filter((entry): entry is { label: string; amount: number } => Boolean(entry));

  return (
    <WorkspaceActivityRow
      title={[item.propertyName?.trim(), item.parkingLabel?.trim()].filter(Boolean).join(' · ') || 'Parking booking'}
      detail={`Booking date: ${formatDate(item.startDate)}${item.endDate !== item.startDate ? ` – ${formatDate(item.endDate)}` : ''}`}
      status={item.bookingStatus ?? undefined}
      amountLabel="Payout"
      amount={money(item.payout)}
    >
      {extras.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 dark:border-white/[0.08] pt-3">
          {extras.map((extra) => (
            <span key={extra.label} className="text-xs text-slate-500 dark:text-[#A1A1AA]">
              {extra.label} <span className="font-semibold text-slate-700 dark:text-white">{money(extra.amount)}</span>
            </span>
          ))}
        </div>
      )}
    </WorkspaceActivityRow>
  );
}

export default function OwnerWalletPanel({ token, activeBank, onNavigateSettings }: Props) {
  const [summary, setSummary] = useState<OwnerEarningsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<OwnerEarningsTransactionItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const activityHeadingRef = useRef<HTMLHeadingElement>(null);

  // Withdrawal modal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const loadSummary = useCallback(async (signal: AbortSignal) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const result = await getOwnerEarningsSummary(token, undefined, signal);
      if (signal.aborted) return;
      setSummary(result);
    } catch (error) {
      if (!signal.aborted) {
        setSummaryError(error instanceof Error ? error.message : 'Unable to load your earnings.');
      }
    } finally {
      if (!signal.aborted) setSummaryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary, refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    setFeedLoading(true);
    setFeedError(null);

    const params: OwnerEarningsTransactionsParams = { page, pageSize: PAGE_SIZE };
    if (typeFilter) params.type = typeFilter;

    getOwnerEarningsTransactions(token, params, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const pages = Number.isFinite(result.totalPages) && result.totalPages > 0
          ? result.totalPages
          : Math.ceil(result.totalCount / PAGE_SIZE);
        if (page > Math.max(1, pages)) {
          setPage(Math.max(1, pages));
          return;
        }
        setItems(result.data);
        setTotalPages(pages);
        setTotalCount(result.totalCount);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFeedError(error instanceof Error ? error.message : 'Unable to load your transactions.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFeedLoading(false);
      });

    return () => controller.abort();
  }, [token, page, typeFilter, refreshToken]);

  const available = summary?.availableEarnings ?? 0;
  const held = summary?.heldEarnings ?? 0;
  const paid = summary?.paidEarnings ?? 0;
  const retryAll = () => setRefreshToken((value) => value + 1);
  const changePage = (nextPage: number) => {
    setFeedLoading(true);
    setFeedError(null);
    setItems([]);
    setPage(nextPage);
    activityHeadingRef.current?.focus({ preventScroll: true });
    activityHeadingRef.current?.scrollIntoView({ block: 'start' });
  };

  const handleConfirmWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 10) {
      setWithdrawError('Minimum withdrawal amount is RM 10.00');
      return;
    }
    if (amountNum > available) {
      setWithdrawError(`Withdrawal amount exceeds your available balance of ${money(available)}`);
      return;
    }

    try {
      setWithdrawLoading(true);
      setWithdrawError(null);
      const res = await requestOwnerWithdrawal(token, amountNum);
      setWithdrawSuccess(`Successfully initiated withdrawal of ${money(amountNum)}. Reference: ${res.referenceNumber || 'Processing'}`);
      setWithdrawAmount('');
      setRefreshToken((v) => v + 1);
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed. Please check your bank details.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Wallet balance</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retryAll}
              disabled={summaryLoading || feedLoading}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1E] px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${summaryLoading || feedLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setShowWithdrawModal(true);
                setWithdrawError(null);
                setWithdrawSuccess(null);
                setWithdrawAmount('');
              }}
              className="workspace-button workspace-button--primary"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
              Withdraw
            </button>
          </div>
        </div>

        {summaryError ? (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {summaryError}
            </span>
            <button type="button" onClick={retryAll} className="font-semibold underline">Retry</button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <StatCard
                label="Available to withdraw"
                value={summaryLoading ? '—' : money(available)}
                hint="Settled payouts in your wallet, available to withdraw to your linked bank account."
                tone="emerald"
                featured
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatCard
                label="On hold"
                value={summaryLoading ? '—' : money(held)}
                hint="Held until the booking completes"
                tone="amber"
              />
              <StatCard
                label="Paid out"
                value={summaryLoading ? '—' : money(paid)}
                hint="Withdrawn to date"
                tone="blue"
              />
              <StatCard
                label="Gross earned"
                value={summaryLoading ? '—' : money(summary?.grossEarnings)}
                hint="Before platform commission"
                tone="slate"
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="workspace-filter-bar">
          <div>
            <h3 ref={activityHeadingRef} tabIndex={-1} className="scroll-mt-24 text-sm font-bold text-slate-900 dark:text-white">Earnings activity</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
              {feedLoading && items.length === 0
                ? 'Loading transactions...'
                : items.length > 0
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + items.length} of ${totalCount} transactions`
                  : `${totalCount} transaction${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="h-3.5 w-3.5 text-slate-400 dark:text-[#A1A1AA]" aria-hidden="true" />
            <SystemSelect
              value={typeFilter}
              onChange={(event) => {
                if (event.target.value === typeFilter) return;
                setItems([]);
                setTotalPages(0);
                setTotalCount(0);
                setFeedLoading(true);
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              disabled={feedLoading}
              aria-label="Filter transactions by type"
            >
              {TRANSACTION_TYPES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </SystemSelect>
          </div>
        </div>

        {feedError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {feedError}
            </span>
            <button type="button" onClick={retryAll} className="font-semibold underline">Retry</button>
          </div>
        )}

        {feedLoading && items.length === 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-8 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600 dark:text-[#0A84FF]" aria-hidden="true" />
            <p className="mt-2 text-xs text-slate-500 dark:text-[#A1A1AA]">Loading earnings activity...</p>
          </div>
        )}

        {!feedLoading && !feedError && items.length === 0 && (
          <WorkspaceEmptyState icon={Clock3} title={typeFilter ? 'No matching transactions' : 'No earnings yet'} description={typeFilter ? 'Choose another transaction type.' : 'Payouts appear here when a booking is completed.'} />
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <TransactionRow key={`${item.bookingId}-${item.createdAt}`} item={item} />
          ))}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Earnings activity pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={page === 1 || feedLoading}
              className="workspace-button workspace-button--secondary"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages || feedLoading}
              className="workspace-button workspace-button--secondary"
            >
              Next
            </button>
          </nav>
        )}
      </section>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowWithdrawModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Withdraw Earnings</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A1A1AA]">
              Transfer your available earnings to your linked bank account.
            </p>

            {!activeBank?.accNo ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">No Bank Account Linked</h4>
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      You must link a valid bank account in Settings before you can request a withdrawal.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWithdrawModal(false);
                        onNavigateSettings?.();
                      }}
                      className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
                    >
                      Go to Bank Settings
                    </button>
                  </div>
                </div>
              </div>
            ) : withdrawSuccess ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="mt-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">Withdrawal Submitted</h4>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">{withdrawSuccess}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-full rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-xs font-bold text-white dark:text-slate-900 hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmWithdraw} className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-100 dark:border-white/[0.08] bg-slate-50 dark:bg-[#202024] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#A1A1AA]">
                    Payout Destination
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{activeBank.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">{activeBank.accNo} · {activeBank.holder}</p>
                    </div>
                    {onNavigateSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowWithdrawModal(false);
                          onNavigateSettings();
                        }}
                        className="text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 dark:border-emerald-950/50 bg-emerald-50/50 dark:bg-emerald-950/10 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-[#A1A1AA]">Available balance:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{money(available)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Withdrawal Amount
                  </label>
                  <div className="relative mt-1.5 flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">RM</span>
                    <input
                      type="number"
                      step="0.01"
                      min="10"
                      max={available}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] py-2 pl-10 pr-16 text-sm font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(available.toFixed(2))}
                      className="absolute right-2 rounded-lg bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/20"
                    >
                      MAX
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Minimum withdrawal is RM 10.00. Processing typically takes 1 business day.
                  </p>
                </div>

                {withdrawError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 p-3 text-xs text-rose-700 dark:text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    disabled={withdrawLoading}
                    className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      withdrawLoading ||
                      available < 10 ||
                      !withdrawAmount ||
                      parseFloat(withdrawAmount) < 10 ||
                      parseFloat(withdrawAmount) > available
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {withdrawLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Withdrawal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
