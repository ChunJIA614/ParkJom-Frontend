import { displayDateOptions, parseTimestamp } from '@/lib/dateTime';
import AdminPageHeader from './AdminPageHeader';
import AdminSummaryCounts from './AdminSummaryCounts';
import SystemSelect from '@/components/ui/SystemSelect';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Play,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import {
  clearSettlementBatch,
  downloadBatchIbgFile,
  downloadSettlementExport,
  generateSettlementBatch,
  getReconciliationReport,
  getSettlementBatchDetail,
  getSettlementBatches,
  getSettlementLedger,
  getSettlementSummary,
  getSettlementWithdrawals,
  submitSettlementBatch,
  submitWithdrawalDecision,
  syncEscrowLedger,
} from '../api/settlementApi';
import type {
  AdminWithdrawalItem,
  OwnerPayout,
  ReconciliationReport,
  SettlementBatchDetail,
  SettlementBatchSummary,
  SettlementLedgerEntry,
  SettlementSummary,
  Transaction,
} from '../types';

interface FinanceSettlementProps {
  token: string;
  payouts?: OwnerPayout[];
  setPayouts?: React.Dispatch<React.SetStateAction<OwnerPayout[]>>;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addActivityLog?: (type: string, message: string, user: string) => void;
  onRefreshDashboard?: () => void | Promise<void>;
  /** Commission rate dynamically loaded from SystemConfiguration table. */
  commissionRate: number | null;
}

type SettlementTab = 'withdrawals' | 'batches' | 'ledger' | 'reconciliation';

const money = (value: number) =>
  `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = parseTimestamp(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString([], displayDateOptions({
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }));
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const statusPillTone = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'cleared':
    case 'matched':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60';
    case 'pending':
    case 'queued':
    case 'generated':
    case 'submitted':
    case 'partiallycleared':
    case 'attentionrequired':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60';
    case 'failed':
    case 'rejected':
    case 'discrepancy':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  }
};

export default function FinanceSettlement({
  token,
  addActivityLog,
  onRefreshDashboard,
  commissionRate,
}: FinanceSettlementProps) {
  const [activeTab, setActiveTab] = useState<SettlementTab>('withdrawals');
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Withdrawals queue state
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalItem[]>([]);
  const [withdrawalsTotal, setWithdrawalsTotal] = useState(0);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [withdrawalsPageSize, setWithdrawalsPageSize] = useState(20);
  const [withdrawalsTotalPages, setWithdrawalsTotalPages] = useState(1);
  const [withdrawalStatus, setWithdrawalStatus] = useState('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<number[]>([]);

  // Batches state
  const [batches, setBatches] = useState<SettlementBatchSummary[]>([]);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesTotalPages, setBatchesTotalPages] = useState(1);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Ledger state
  const [ledger, setLedger] = useState<SettlementLedgerEntry[]>([]);
  const [ledgerStats, setLedgerStats] = useState({
    taxRatePercent: 8,
    totalGrossVolume: 0,
    totalPlatformCommission: 0,
    totalTaxAmount: 0,
    totalNetCommission: 0,
  });
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerType, setLedgerType] = useState('all');
  const [ledgerStatus, setLedgerStatus] = useState('all');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Reconciliation state
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  // Action & modal state
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null);

  // Generate Batch modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRail, setBatchRail] = useState<'IBG' | 'DuitNow'>('IBG');
  const [includeAutoWithdraw, setIncludeAutoWithdraw] = useState(true);
  const [batchNotes, setBatchNotes] = useState('');

  // Withdrawal decision modal
  const [decisionTarget, setDecisionTarget] = useState<{ item: AdminWithdrawalItem; approve: boolean } | null>(null);
  const [decisionBankRef, setDecisionBankRef] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  // Batch detail & bank clearing sync modal
  const [batchDetail, setBatchDetail] = useState<SettlementBatchDetail | null>(null);
  const [batchDetailLoading, setBatchDetailLoading] = useState(false);
  const [clearingBankRef, setClearingBankRef] = useState('');
  const [itemClearingOverrides, setItemClearingOverrides] = useState<Record<number, { status: 'Cleared' | 'Rejected'; reason: string }>>({});

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setSummaryLoading(true);
    try {
      const data = await getSettlementSummary(token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settlement summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, [token]);

  const loadWithdrawals = useCallback(async () => {
    if (!token) return;
    setWithdrawalsLoading(true);
    try {
      const page = await getSettlementWithdrawals(token, {
        status: withdrawalStatus,
        search: withdrawalSearch.trim() || undefined,
        page: withdrawalsPage,
        pageSize: withdrawalsPageSize,
      });
      setWithdrawals(page.items);
      setWithdrawalsTotal(page.totalCount);
      setWithdrawalsTotalPages(Math.max(1, page.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load withdrawals.');
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [token, withdrawalSearch, withdrawalStatus, withdrawalsPage, withdrawalsPageSize]);

  const loadBatches = useCallback(async () => {
    if (!token) return;
    setBatchesLoading(true);
    try {
      const page = await getSettlementBatches(token, { page: batchesPage, pageSize: 15 });
      setBatches(page.items);
      setBatchesTotal(page.totalCount);
      setBatchesTotalPages(Math.max(1, page.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settlement batches.');
    } finally {
      setBatchesLoading(false);
    }
  }, [batchesPage, token]);

  const loadLedger = useCallback(async () => {
    if (!token) return;
    setLedgerLoading(true);
    try {
      const page = await getSettlementLedger(token, {
        from: ledgerFrom || undefined,
        to: ledgerTo || undefined,
        type: ledgerType,
        status: ledgerStatus,
        search: ledgerSearch.trim() || undefined,
        page: ledgerPage,
        pageSize: ledgerPageSize,
      });
      setLedger(page.items);
      setLedgerStats({
        taxRatePercent: page.taxRatePercent,
        totalGrossVolume: page.totalGrossVolume,
        totalPlatformCommission: page.totalPlatformCommission,
        totalTaxAmount: page.totalTaxAmount,
        totalNetCommission: page.totalNetCommission,
      });
      setLedgerTotal(page.totalCount);
      setLedgerTotalPages(Math.max(1, page.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load financial journal.');
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerFrom, ledgerPage, ledgerPageSize, ledgerSearch, ledgerStatus, ledgerTo, ledgerType, token]);

  const loadReconciliation = useCallback(async () => {
    if (!token) return;
    setReconciliationLoading(true);
    try {
      const report = await getReconciliationReport(token, {
        from: ledgerFrom || undefined,
        to: ledgerTo || undefined,
      });
      setReconciliation(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run reconciliation.');
    } finally {
      setReconciliationLoading(false);
    }
  }, [ledgerFrom, ledgerTo, token]);

  const refreshAll = useCallback(async () => {
    setError(null);
    await loadSummary();
    if (activeTab === 'withdrawals') await loadWithdrawals();
    if (activeTab === 'batches') await loadBatches();
    if (activeTab === 'ledger') await loadLedger();
    if (activeTab === 'reconciliation') await loadReconciliation();
    await onRefreshDashboard?.();
  }, [activeTab, loadBatches, loadLedger, loadReconciliation, loadSummary, loadWithdrawals, onRefreshDashboard]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeTab === 'withdrawals') void loadWithdrawals();
    else if (activeTab === 'batches') void loadBatches();
    else if (activeTab === 'ledger') void loadLedger();
    else if (activeTab === 'reconciliation') void loadReconciliation();
  }, [activeTab, loadBatches, loadLedger, loadReconciliation, loadWithdrawals]);

  const eligiblePendingWithdrawals = useMemo(
    () => withdrawals.filter((w) => w.status === 'Pending' && (!w.batchItemStatus || w.batchItemStatus === 'Rejected')),
    [withdrawals],
  );

  const handleToggleSelectTx = (txId: number) => {
    setSelectedTxIds((prev) => (prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]));
  };

  const handleSelectAllEligible = () => {
    if (eligiblePendingWithdrawals.length === 0) return;
    const allSelected = eligiblePendingWithdrawals.every((w) => selectedTxIds.includes(w.transactionId));
    setSelectedTxIds(allSelected ? [] : eligiblePendingWithdrawals.map((w) => w.transactionId));
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!token || exportingFormat) return;
    setExportingFormat(format);
    setError(null);
    try {
      const { blob, filename } = await downloadSettlementExport(token, {
        format,
        from: ledgerFrom || undefined,
        to: ledgerTo || undefined,
        type: ledgerType,
        status: ledgerStatus,
        search: ledgerSearch.trim() || undefined,
      });
      triggerBlobDownload(blob, filename);
      setToast(`Exported accounting journal as ${filename}`);
      addActivityLog?.('settlement', `Exported settlement journal (${format.toUpperCase()}).`, 'Admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to export ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSyncEscrow = async () => {
    if (!token || busyKey) return;
    setBusyKey('escrow-sync');
    setError(null);
    try {
      const { message } = await syncEscrowLedger(token);
      setToast(message);
      addActivityLog?.('settlement', message, 'Admin');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synchronize escrow ledger.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmWithdrawalDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !decisionTarget || busyKey) return;
    if (!decisionTarget.approve && !decisionReason.trim()) {
      setError('A rejection reason is required before refunding the withdrawal.');
      return;
    }
    setBusyKey(`decision-${decisionTarget.item.transactionId}`);
    setError(null);
    try {
      const { message } = await submitWithdrawalDecision(token, decisionTarget.item.transactionId, {
        approve: decisionTarget.approve,
        bankReference: decisionBankRef.trim() || undefined,
        reason: decisionReason.trim() || undefined,
      });
      setDecisionTarget(null);
      setDecisionBankRef('');
      setDecisionReason('');
      setToast(message);
      addActivityLog?.('settlement', message, 'Admin');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process withdrawal decision.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || busyKey) return;
    setBusyKey('generate-batch');
    setError(null);
    try {
      const { message, detail } = await generateSettlementBatch(token, {
        rail: batchRail,
        transactionIds: selectedTxIds.length > 0 ? selectedTxIds : undefined,
        includeAutoWithdrawOwners: includeAutoWithdraw,
        notes: batchNotes.trim() || undefined,
      });
      setShowBatchModal(false);
      setSelectedTxIds([]);
      setBatchNotes('');
      setToast(message);
      addActivityLog?.('settlement', message, 'Admin');
      setBatchDetail(detail);
      setItemClearingOverrides({});
      setClearingBankRef('');
      setActiveTab('batches');
      await loadSummary();
      await loadBatches();
      await onRefreshDashboard?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate settlement batch.');
    } finally {
      setBusyKey(null);
    }
  };

  const openBatchDetail = async (batchId: number) => {
    if (!token) return;
    setBatchDetailLoading(true);
    setError(null);
    try {
      const detail = await getSettlementBatchDetail(token, batchId);
      setBatchDetail(detail);
      setClearingBankRef(detail.batch.bankReference ?? '');
      const initialOverrides: Record<number, { status: 'Cleared' | 'Rejected'; reason: string }> = {};
      for (const item of detail.items) {
        if (item.status === 'Queued' || item.status === 'Submitted') {
          initialOverrides[item.settlementBatchItemId] = { status: 'Cleared', reason: '' };
        }
      }
      setItemClearingOverrides(initialOverrides);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load batch details.');
    } finally {
      setBatchDetailLoading(false);
    }
  };

  const handleDownloadIbg = async (batchId: number) => {
    if (!token || busyKey) return;
    setBusyKey(`ibg-${batchId}`);
    try {
      const { blob, filename } = await downloadBatchIbgFile(token, batchId);
      triggerBlobDownload(blob, filename);
      setToast(`Downloaded BNM IBG batch file (${filename}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download IBG file.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmitBatch = async (batchId: number) => {
    if (!token || busyKey) return;
    setBusyKey(`submit-${batchId}`);
    setError(null);
    try {
      const { message, detail } = await submitSettlementBatch(token, batchId);
      setBatchDetail(detail);
      setToast(message);
      addActivityLog?.('settlement', message, 'Admin');
      await loadBatches();
      await loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit batch.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleClearBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchDetail || busyKey) return;
    setBusyKey(`clear-${batchDetail.batch.settlementBatchId}`);
    setError(null);
    try {
      const itemPayload = Object.entries(itemClearingOverrides).map(([itemId, val]) => ({
        settlementBatchItemId: Number(itemId),
        status: val.status,
        failureReason: val.status === 'Rejected' ? (val.reason.trim() || 'Rejected by bank clearing') : undefined,
      }));
      const { message, detail } = await clearSettlementBatch(token, batchDetail.batch.settlementBatchId, {
        bankReference: clearingBankRef.trim() || undefined,
        items: itemPayload.length > 0 ? itemPayload : undefined,
      });
      setBatchDetail(detail);
      setItemClearingOverrides({});
      setToast(message);
      addActivityLog?.('settlement', message, 'Admin');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synchronize bank clearing.');
    } finally {
      setBusyKey(null);
    }
  };

  const activeCommission = summary?.commissionRate ?? commissionRate;
  const activeTaxRate = summary?.taxRatePercent ?? 8;
  const tabBusy = summaryLoading || withdrawalsLoading || batchesLoading || ledgerLoading || reconciliationLoading;

  return (
    <div id="finance-settlement" className="space-y-6">
      <AdminPageHeader
        headingId="finance-title"
        title="Financial settlement"
        description="Clear DuitNow/IBG payouts, sync escrow, export journals, and reconcile Stripe receipts."
        isLoading={tabBusy}
        onRefresh={() => void refreshAll()}
      >
        <button
          type="button"
          onClick={() => void handleExport('csv')}
          disabled={exportingFormat !== null}
          className="workspace-button workspace-button--secondary"
        >
          {exportingFormat === 'csv' ? <Loader2 size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />}
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExport('xlsx')}
          disabled={exportingFormat !== null}
          className="workspace-button workspace-button--primary"
        >
          {exportingFormat === 'xlsx' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          Export XLSX
        </button>
      </AdminPageHeader>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top 3 Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Platform Commission</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {activeCommission === null ? '—' : `${activeCommission}%`}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Wallet {money(summary?.platformWalletBalance ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Gross commission {money(summary?.totalGrossCommissions ?? 0)} · SST ({activeTaxRate}%) {money(summary?.totalCommissionTaxSst ?? 0)} · Overstay penalties {money(summary?.totalOverstayPenaltiesCollected ?? 0)}.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">IBG &amp; DuitNow Batches</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary ? `${summary.pendingWithdrawalsCount} queued` : '—'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {money(summary?.pendingWithdrawalsAmount ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Next BNM IBG cut-off: {summary?.nextScheduledIbgCutoffUtc ? formatDateTime(summary.nextScheduledIbgCutoffUtc) : 'Tue & Fri 14:00 MYT'} · {summary?.eligibleAutoWithdrawOwnersCount ?? 0} auto-withdraw owner(s) ready ({money(summary?.eligibleAutoWithdrawAmount ?? 0)}).
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Escrow &amp; Ledger</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusPillTone(summary?.reconciliationHealth ?? 'Matched')}`}>
              <Scale className="h-3 w-3" />
              {summary?.reconciliationHealth ?? 'Matched'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {money(summary?.totalEscrowOnHold ?? 0)}
              </span>
              <span className="ml-1.5 text-xs text-slate-500 font-medium">escrow held</span>
            </div>
            <button
              type="button"
              onClick={() => void handleSyncEscrow()}
              disabled={busyKey === 'escrow-sync'}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-300"
            >
              {busyKey === 'escrow-sync' ? 'Syncing…' : `Sync Escrow (${summary?.unreleasedCompletedBookingsCount ?? 0})`}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Owner available {money(summary?.totalOwnerAvailable ?? 0)} · Cleared payouts {money(summary?.clearedWithdrawalsAmount ?? 0)} · Stripe receipts {money(summary?.totalStripeTopUps ?? 0)}.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Financial settlement sections">
          {(
            [
              { id: 'withdrawals', label: `Payout Clearing Queue (${summary?.pendingWithdrawalsCount ?? withdrawals.filter((w) => w.status === 'Pending').length})`, icon: Landmark },
              { id: 'batches', label: `IBG / DuitNow Batches (${batchesTotal})`, icon: Send },
              { id: 'ledger', label: 'Financial Journal & Tax', icon: Receipt },
              { id: 'reconciliation', label: 'Stripe & Escrow Reconciliation', icon: Scale },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowBatchModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Play className="h-3.5 w-3.5" />
          Generate IBG / DuitNow Batch
        </button>
      </div>

      {/* TAB 1: PAYOUT CLEARING QUEUE */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-900">
                {(['all', 'Pending', 'Completed', 'Failed'] as const).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => {
                      setWithdrawalStatus(statusOption);
                      setWithdrawalsPage(1);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      withdrawalStatus === statusOption
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
                    }`}
                  >
                    {statusOption === 'all' ? 'All' : statusOption}
                  </button>
                ))}
              </div>
              {eligiblePendingWithdrawals.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllEligible}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {eligiblePendingWithdrawals.every((w) => selectedTxIds.includes(w.transactionId))
                    ? 'Clear selection'
                    : `Select ${eligiblePendingWithdrawals.length} batchable`}
                </button>
              )}
              {selectedTxIds.length > 0 && (
                <span className="text-xs font-semibold text-blue-600">
                  {selectedTxIds.length} selected for batch
                </span>
              )}
            </div>

            <label className="relative block w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={withdrawalSearch}
                onChange={(e) => {
                  setWithdrawalSearch(e.target.value);
                  setWithdrawalsPage(1);
                }}
                placeholder="Search owner, ref, bank, account…"
                className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {withdrawalsLoading && withdrawals.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading withdrawal queue…
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-500">
              <Landmark className="h-7 w-7 text-slate-300" />
              <p className="text-sm font-semibold">No withdrawal requests match the current filters</p>
              <p className="text-xs text-slate-400">Owner withdrawal requests and Auto-Withdraw sweeps appear here for clearing.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="workspace-record-table w-full min-w-[920px] border-separate border-spacing-0 text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-3 w-10">Pick</th>
                      <th className="border-b border-slate-200 px-4 py-3">Reference &amp; Date</th>
                      <th className="border-b border-slate-200 px-4 py-3">Property Owner</th>
                      <th className="border-b border-slate-200 px-4 py-3">Malaysian Bank (BIC)</th>
                      <th className="border-b border-slate-200 px-4 py-3">Amount</th>
                      <th className="border-b border-slate-200 px-4 py-3">Clearing Status</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {withdrawals.map((item) => {
                      const canBatch = item.status === 'Pending' && (!item.batchItemStatus || item.batchItemStatus === 'Rejected');
                      return (
                        <tr key={item.transactionId} className="hover:bg-slate-50/70">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              disabled={!canBatch}
                              checked={selectedTxIds.includes(item.transactionId)}
                              onChange={() => handleToggleSelectTx(item.transactionId)}
                              aria-label={`Select ${item.referenceNumber}`}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold text-slate-800">{item.referenceNumber}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{item.ownerName}</p>
                            <p className="text-[11px] text-slate-400">{item.ownerEmail}</p>
                            {item.autoWithdraw && (
                              <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                Auto-Withdraw Enabled
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">
                              {item.bankName} <span className="font-mono text-[10px] text-slate-400">({item.bankCode})</span>
                            </p>
                            <p className="font-mono text-[11px] text-slate-600">{item.accountNumber}</p>
                            <p className="text-[11px] text-slate-400">{item.accountHolderName}</p>
                          </td>
                          <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                            {money(item.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillTone(item.status)}`}>
                              {item.status}
                            </span>
                            {item.batchReference && (
                              <p className="mt-1 font-mono text-[10px] text-slate-500">
                                {item.batchReference} · {item.batchItemStatus}
                              </p>
                            )}
                            {item.clearingReference && (
                              <p className="font-mono text-[10px] text-emerald-600">Ref: {item.clearingReference}</p>
                            )}
                            {item.failureReason && (
                              <p className="text-[10px] text-rose-600">{item.failureReason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.status === 'Pending' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDecisionTarget({ item, approve: true });
                                    setDecisionBankRef('');
                                    setDecisionReason('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDecisionTarget({ item, approve: false });
                                    setDecisionBankRef('');
                                    setDecisionReason('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Finalized</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <span>Showing {withdrawals.length} of {withdrawalsTotal} withdrawal(s)</span>
            <div className="flex items-center gap-3">
              <SystemSelect
                value={withdrawalsPageSize}
                onChange={(e) => {
                  setWithdrawalsPageSize(Number(e.target.value));
                  setWithdrawalsPage(1);
                }}
                aria-label="Withdrawals page size"
                className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </SystemSelect>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={withdrawalsPage <= 1}
                  onClick={() => setWithdrawalsPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-20 text-center font-semibold text-slate-700">
                  Page {withdrawalsPage} / {withdrawalsTotalPages}
                </span>
                <button
                  type="button"
                  disabled={withdrawalsPage >= withdrawalsTotalPages}
                  onClick={() => setWithdrawalsPage((p) => p + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IBG / DUITNOW BATCHES */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {batchesLoading && batches.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settlement batches…
            </div>
          ) : batches.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-500">
              <Send className="h-7 w-7 text-slate-300" />
              <p className="text-sm font-semibold">No IBG or DuitNow clearing batches generated yet</p>
              <p className="text-xs text-slate-400">Click &ldquo;Generate IBG / DuitNow Batch&rdquo; to bundle pending owner withdrawals into a BNM-compliant clearing file.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="workspace-record-table w-full min-w-[880px] border-separate border-spacing-0 text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3">Batch Reference</th>
                      <th className="border-b border-slate-200 px-4 py-3">Rail &amp; Schedule</th>
                      <th className="border-b border-slate-200 px-4 py-3">Items &amp; Total</th>
                      <th className="border-b border-slate-200 px-4 py-3">BNM Checksum</th>
                      <th className="border-b border-slate-200 px-4 py-3">Status</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {batches.map((b) => (
                      <tr key={b.settlementBatchId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-mono font-bold text-slate-900">{b.batchReference}</p>
                          <p className="text-[11px] text-slate-400">{formatDateTime(b.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                            {b.rail} · {b.bnmFormatVersion}
                          </span>
                          <p className="mt-1 text-[11px] text-slate-500">{b.scheduleWindow}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{money(b.totalAmount)}</p>
                          <p className="text-[11px] text-slate-500">{b.itemCount} beneficiary item(s)</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                          {b.fileChecksum ? `${b.fileChecksum.slice(0, 16)}…` : '—'}
                          {b.bankReference && (
                            <p className="mt-1 text-emerald-600">Bank: {b.bankReference}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillTone(b.status)}`}>
                            {b.status}
                          </span>
                          {b.clearedAt && <p className="mt-1 text-[10px] text-slate-400">Cleared {formatDateTime(b.clearedAt)}</p>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDownloadIbg(b.settlementBatchId)}
                              disabled={busyKey === `ibg-${b.settlementBatchId}`}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              .IBG
                            </button>
                            {b.status === 'Generated' && (
                              <button
                                type="button"
                                onClick={() => void handleSubmitBatch(b.settlementBatchId)}
                                disabled={busyKey === `submit-${b.settlementBatchId}`}
                                className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                              >
                                Submit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void openBatchDetail(b.settlementBatchId)}
                              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                            >
                              Inspect / Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FINANCIAL JOURNAL & TAX */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400">Filtered Gross Volume</span>
              <p className="mt-1 text-lg font-bold text-slate-900">{money(ledgerStats.totalGrossVolume)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400">Platform Commissions</span>
              <p className="mt-1 text-lg font-bold text-blue-600">{money(ledgerStats.totalPlatformCommission)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400">SST Liability ({ledgerStats.taxRatePercent}%)</span>
              <p className="mt-1 text-lg font-bold text-amber-600">{money(ledgerStats.totalTaxAmount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-bold uppercase text-slate-400">Net Commission Post-SST</span>
              <p className="mt-1 text-lg font-bold text-emerald-600">{money(ledgerStats.totalNetCommission)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3.5 md:grid-cols-5">
            <input
              type="date"
              value={ledgerFrom}
              onChange={(e) => {
                setLedgerFrom(e.target.value);
                setLedgerPage(1);
              }}
              aria-label="Filter from date"
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"
            />
            <input
              type="date"
              value={ledgerTo}
              onChange={(e) => {
                setLedgerTo(e.target.value);
                setLedgerPage(1);
              }}
              aria-label="Filter to date"
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"
            />
            <SystemSelect
              value={ledgerType}
              onChange={(e) => {
                setLedgerType(e.target.value);
                setLedgerPage(1);
              }}
              aria-label="Transaction type filter"
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"
            >
              <option value="all">All Types</option>
              <option value="Payment">Payment</option>
              <option value="OwnerPayout">OwnerPayout</option>
              <option value="PlatformCommission">PlatformCommission</option>
              <option value="TopUp">TopUp</option>
              <option value="Withdrawal">Withdrawal</option>
              <option value="Refund">Refund</option>
              <option value="OverstayPenalty">OverstayPenalty</option>
            </SystemSelect>
            <SystemSelect
              value={ledgerStatus}
              onChange={(e) => {
                setLedgerStatus(e.target.value);
                setLedgerPage(1);
              }}
              aria-label="Transaction status filter"
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </SystemSelect>
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={ledgerSearch}
                onChange={(e) => {
                  setLedgerSearch(e.target.value);
                  setLedgerPage(1);
                }}
                placeholder="Search ref, email, booking…"
                className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700"
              />
            </label>
          </div>

          {ledgerLoading && ledger.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading journal stream…
            </div>
          ) : ledger.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-500">
              <Receipt className="h-7 w-7 text-slate-300" />
              <p className="text-sm font-semibold">No journal entries match the filters</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="workspace-record-table w-full min-w-[940px] border-separate border-spacing-0 text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3">Reference</th>
                      <th className="border-b border-slate-200 px-4 py-3">Type &amp; Method</th>
                      <th className="border-b border-slate-200 px-4 py-3">Account</th>
                      <th className="border-b border-slate-200 px-4 py-3">Gross Amount</th>
                      <th className="border-b border-slate-200 px-4 py-3">SST Tax</th>
                      <th className="border-b border-slate-200 px-4 py-3">Net Amount</th>
                      <th className="border-b border-slate-200 px-4 py-3">Status &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {ledger.map((entry) => (
                      <tr key={entry.transactionId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold text-slate-800">{entry.referenceNumber}</p>
                          {entry.bookingReference && (
                            <p className="font-mono text-[10px] text-slate-400">
                              {entry.bookingReference} {entry.spotLabel ? `· ${entry.spotLabel}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{entry.type}</p>
                          <p className="text-[11px] text-slate-400">{entry.paymentMethod}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{entry.userName ?? entry.ledgerAccount}</p>
                          <p className="text-[11px] text-slate-400">{entry.userEmail ?? entry.ledgerAccount}</p>
                        </td>
                        <td className={`px-4 py-3 font-bold tabular-nums ${entry.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {money(entry.amount)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-amber-700">
                          {entry.taxAmount > 0 ? `${money(entry.taxAmount)} (${entry.taxRatePercent}%)` : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-800">
                          {money(entry.netAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillTone(entry.status)}`}>
                            {entry.status}
                          </span>
                          <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(entry.createdAt)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <span>Showing {ledger.length} of {ledgerTotal} ledger row(s)</span>
            <div className="flex items-center gap-3">
              <SystemSelect
                value={ledgerPageSize}
                onChange={(e) => {
                  setLedgerPageSize(Number(e.target.value));
                  setLedgerPage(1);
                }}
                aria-label="Ledger page size"
                className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </SystemSelect>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-20 text-center font-semibold text-slate-700">
                  Page {ledgerPage} / {ledgerTotalPages}
                </span>
                <button
                  type="button"
                  disabled={ledgerPage >= ledgerTotalPages}
                  onClick={() => setLedgerPage((p) => p + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STRIPE & ESCROW RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusPillTone(reconciliation?.overallStatus ?? 'Matched')}`}>
                <Scale className="h-3.5 w-3.5" />
                Overall Status: {reconciliation?.overallStatus ?? 'Checking…'}
              </span>
              {reconciliation?.generatedAtUtc && (
                <span className="text-xs text-slate-500">
                  Evaluated {formatDateTime(reconciliation.generatedAtUtc)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSyncEscrow()}
                disabled={busyKey === 'escrow-sync'}
                className="workspace-button workspace-button--secondary"
              >
                <RefreshCw size={14} className={busyKey === 'escrow-sync' ? 'animate-spin' : undefined} />
                Sync Escrow Releases
              </button>
              <button
                type="button"
                onClick={() => void loadReconciliation()}
                disabled={reconciliationLoading}
                className="workspace-button workspace-button--primary"
              >
                <Scale size={14} />
                Run Reconciliation
              </button>
            </div>
          </div>

          {reconciliation && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reconciliation.sections.map((section) => (
                  <div key={section.key} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusPillTone(section.status)}`}>
                        {section.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Expected</span>
                        <span className="font-bold text-slate-800">{money(section.expectedAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Recorded</span>
                        <span className="font-bold text-slate-800">{money(section.recordedAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Variance</span>
                        <span className={`font-bold ${Math.abs(section.varianceAmount) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {money(section.varianceAmount)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{section.notes}</p>
                  </div>
                ))}
              </div>

              <AdminSummaryCounts
                items={[
                  { label: 'Stripe Checkouts', value: reconciliation.stripeCompletedPaymentsCount },
                  { label: 'Top-Up Credits', value: reconciliation.stripeTopUpTransactionsCount },
                  { label: 'Public Drive-In Stripe', value: reconciliation.publicParkingStripeCount },
                  { label: 'Booking Split Exceptions', value: reconciliation.bookingSplitExceptionsCount },
                ]}
              />

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">Stripe Commuter Receipts &amp; Exception Audit</h3>
                </div>
                {reconciliation.exceptionsAndRecentReceipts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No Stripe receipts or split exceptions recorded in the selected window.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="workspace-record-table w-full min-w-[840px] border-separate border-spacing-0 text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Source &amp; Reference</th>
                          <th className="border-b border-slate-200 px-4 py-3">Account</th>
                          <th className="border-b border-slate-200 px-4 py-3">Stripe / Booking</th>
                          <th className="border-b border-slate-200 px-4 py-3">Ledger</th>
                          <th className="border-b border-slate-200 px-4 py-3">Status</th>
                          <th className="border-b border-slate-200 px-4 py-3">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {reconciliation.exceptionsAndRecentReceipts.map((row, idx) => (
                          <tr key={`${row.reference}-${idx}`} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{row.source}</p>
                              <p className="font-mono text-[10px] text-slate-400">{row.reference}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.userEmail}</td>
                            <td className="px-4 py-3 font-bold tabular-nums">{money(row.stripeOrBookingAmount)}</td>
                            <td className="px-4 py-3 font-semibold tabular-nums">{money(row.ledgerAmount)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillTone(row.matchStatus)}`}>
                                {row.matchStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-500">
                              <p>{row.detail}</p>
                              <p className="text-[10px] text-slate-400">{formatDateTime(row.timestampUtc)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: GENERATE BATCH */}
      {showBatchModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Generate Bank Clearing Batch</h3>
              <button type="button" onClick={() => setShowBatchModal(false)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleGenerateBatch(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Malaysian Clearing Rail</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['IBG', 'DuitNow'] as const).map((rail) => (
                    <button
                      key={rail}
                      type="button"
                      onClick={() => setBatchRail(rail)}
                      className={`rounded-xl border px-3 py-2.5 font-bold transition ${
                        batchRail === rail
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-zinc-300'
                      }`}
                    >
                      {rail === 'IBG' ? 'BNM Interbank GIRO (IBG)' : 'PayNet DuitNow Bulk'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <input
                  type="checkbox"
                  checked={includeAutoWithdraw}
                  onChange={(e) => setIncludeAutoWithdraw(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  <strong className="block text-slate-800 dark:text-white">Sweep Auto-Withdraw eligible owners</strong>
                  <span className="text-slate-500">
                    Automatically queue owners with AutoWithdraw enabled and wallet balance ≥ RM 10.00 ({summary?.eligibleAutoWithdrawOwnersCount ?? 0} eligible, {money(summary?.eligibleAutoWithdrawAmount ?? 0)}).
                  </span>
                </span>
              </label>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-white/[0.04] dark:text-zinc-300">
                {selectedTxIds.length > 0
                  ? `Will bundle ${selectedTxIds.length} selected pending withdrawal(s) (plus any Auto-Withdraw sweeps if checked).`
                  : 'Will bundle all currently unbatched Pending withdrawal requests.'}
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Batch Notes (optional)</label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="e.g. Friday afternoon BNM clearing run"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyKey === 'generate-batch'}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyKey === 'generate-batch' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Generate Batch
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: WITHDRAWAL DECISION */}
      {decisionTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {decisionTarget.approve ? 'Clear Owner Payout' : 'Reject & Refund Withdrawal'}
              </h3>
              <button type="button" onClick={() => setDecisionTarget(null)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmWithdrawalDecision(e)} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1 dark:bg-white/[0.04]">
                <p className="font-mono font-bold text-slate-800 dark:text-white">{decisionTarget.item.referenceNumber}</p>
                <p className="text-slate-600 dark:text-zinc-300">
                  {decisionTarget.item.ownerName} · {decisionTarget.item.bankName} ({decisionTarget.item.accountNumber})
                </p>
                <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{money(decisionTarget.item.amount)}</p>
              </div>

              {decisionTarget.approve ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Bank Clearing / DuitNow Reference (optional)</label>
                  <input
                    type="text"
                    value={decisionBankRef}
                    onChange={(e) => setDecisionBankRef(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Rejection Reason (refunds owner wallet)</label>
                  <textarea
                    required
                    rows={3}
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="e.g. Beneficiary account holder name mismatch"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDecisionTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyKey?.startsWith('decision-')}
                  className={`rounded-xl px-4 py-2 font-bold text-white ${
                    decisionTarget.approve ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {decisionTarget.approve ? 'Confirm Clear' : 'Confirm Reject & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: BATCH DETAIL & BANK CLEARING SYNC */}
      {(batchDetail || batchDetailLoading) && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            {batchDetailLoading || !batchDetail ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading BNM clearing batch…
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white">{batchDetail.batch.batchReference}</h3>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillTone(batchDetail.batch.status)}`}>
                        {batchDetail.batch.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      {batchDetail.batch.rail} · {batchDetail.batch.itemCount} item(s) · {money(batchDetail.batch.totalAmount)} · SHA-256: <span className="font-mono">{batchDetail.batch.fileChecksum.slice(0, 20)}…</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setBatchDetail(null)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadIbg(batchDetail.batch.settlementBatchId)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
                  >
                    <ArrowDownToLine size={14} /> Download BNM IBG File
                  </button>
                  {batchDetail.batch.status === 'Generated' && (
                    <button
                      type="button"
                      onClick={() => void handleSubmitBatch(batchDetail.batch.settlementBatchId)}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 inline-flex items-center gap-1.5"
                    >
                      <Send size={14} /> Mark Submitted to Bank
                    </button>
                  )}
                </div>

                <form onSubmit={(e) => void handleClearBatch(e)} className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-white/[0.04] dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-2.5">Owner &amp; Tx Ref</th>
                          <th className="px-3 py-2.5">Bank &amp; BIC</th>
                          <th className="px-3 py-2.5">Amount</th>
                          <th className="px-3 py-2.5">Clearing Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/10 dark:text-zinc-200">
                        {batchDetail.items.map((item) => {
                          const override = itemClearingOverrides[item.settlementBatchItemId];
                          const isPending = item.status === 'Queued' || item.status === 'Submitted';
                          return (
                            <tr key={item.settlementBatchItemId}>
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-slate-800 dark:text-white">{item.ownerName}</p>
                                <p className="font-mono text-[10px] text-slate-400">{item.transactionReference}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="font-semibold">{item.bankName} ({item.bankCode})</p>
                                <p className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">{item.accountNumber} · {item.accountHolderName}</p>
                              </td>
                              <td className="px-3 py-2.5 font-bold tabular-nums">{money(item.amount)}</td>
                              <td className="px-3 py-2.5">
                                {isPending && override ? (
                                  <div className="space-y-1.5">
                                    <select
                                      value={override.status}
                                      onChange={(e) =>
                                        setItemClearingOverrides((prev) => ({
                                          ...prev,
                                          [item.settlementBatchItemId]: {
                                            ...prev[item.settlementBatchItemId],
                                            status: e.target.value as 'Cleared' | 'Rejected',
                                          },
                                        }))
                                      }
                                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                                    >
                                      <option value="Cleared">Cleared</option>
                                      <option value="Rejected">Rejected (Refund Wallet)</option>
                                    </select>
                                    {override.status === 'Rejected' && (
                                      <input
                                        type="text"
                                        placeholder="Rejection reason"
                                        value={override.reason}
                                        onChange={(e) =>
                                          setItemClearingOverrides((prev) => ({
                                            ...prev,
                                            [item.settlementBatchItemId]: {
                                              ...prev[item.settlementBatchItemId],
                                              reason: e.target.value,
                                            },
                                          }))
                                        }
                                        className="block w-full rounded-lg border border-rose-200 px-2 py-1 text-[11px] dark:border-rose-800 dark:bg-[#1c1c1f] dark:text-white"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillTone(item.status)}`}>
                                      {item.status}
                                    </span>
                                    {item.clearingReference && <p className="mt-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">{item.clearingReference}</p>}
                                    {item.failureReason && <p className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">{item.failureReason}</p>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {Object.keys(itemClearingOverrides).length > 0 && (
                    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-end sm:justify-between dark:border-emerald-800/50 dark:bg-emerald-950/30">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1">Bank Clearing / PayNet Reference</label>
                        <input
                          type="text"
                          value={clearingBankRef}
                          onChange={(e) => setClearingBankRef(e.target.value)}
                          placeholder="Auto-assigned if empty (e.g. PAYNET-IBG-20261122)"
                          className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-emerald-700/60 dark:bg-[#1c1c1f] dark:text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busyKey === `clear-${batchDetail.batch.settlementBatchId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Sync Bank Clearing Results
                      </button>
                    </div>
                  )}
                </form>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">BNM IBG File Payload Preview</span>
                  <pre className="max-h-40 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                    {batchDetail.ibgPreview}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
