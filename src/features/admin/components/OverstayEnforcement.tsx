import { displayDateOptions, parseTimestamp } from '@/lib/dateTime';
import AdminPageHeader from './AdminPageHeader';
import AdminSummaryCounts from './AdminSummaryCounts';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Gavel,
  Loader2,
  Play,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  chargeOverstayPenalty,
  dispatchOverstayWarning,
  getOverstayCases,
  getOverstaySummary,
  reviewOverstayDispute,
  triggerOverstayScan,
  updateOverstayPolicy,
  waiveOverstayPenalty,
} from '../api/overstayApi';
import type { OverstayCaseDto, OverstayRecord, OverstaySummary, SystemConfig } from '../types';

interface OverstayEnforcementProps {
  token: string;
  overstays?: OverstayRecord[];
  setOverstays?: React.Dispatch<React.SetStateAction<OverstayRecord[]>>;
  addActivityLog?: (type: string, message: string, user: string) => void;
  onRefreshDashboard?: () => void | Promise<void>;
  onSystemConfigUpdated?: (config: SystemConfig) => void;
  /** Grace period minutes dynamically loaded from SystemConfiguration table. */
  gracePeriodMinutes: number | null;
}

type OverstayFilterTab = 'all' | 'open' | 'PaymentDue' | 'Disputed' | 'closed';

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

const statusBadgeTone = (status: string) => {
  switch (status.toLowerCase()) {
    case 'resolved':
    case 'waived':
    case 'released':
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60';
    case 'warningsent':
    case 'detected':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60';
    case 'penalized':
    case 'paymentdue':
    case 'disputed':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  }
};

export default function OverstayEnforcement({
  token,
  addActivityLog,
  onRefreshDashboard,
  onSystemConfigUpdated,
  gracePeriodMinutes,
}: OverstayEnforcementProps) {
  const [summary, setSummary] = useState<OverstaySummary | null>(null);
  const [cases, setCases] = useState<OverstayCaseDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [filterTab, setFilterTab] = useState<OverstayFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busyCaseKey, setBusyCaseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Policy modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyGrace, setPolicyGrace] = useState(15);
  const [policyMultiplier, setPolicyMultiplier] = useState(1.5);
  const [policyMaxDaily, setPolicyMaxDaily] = useState(30);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Waive modal
  const [waiveTarget, setWaiveTarget] = useState<OverstayCaseDto | null>(null);
  const [waiveFull, setWaiveFull] = useState(true);
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');

  // Dispute modal
  const [disputeTarget, setDisputeTarget] = useState<OverstayCaseDto | null>(null);
  const [disputeAction, setDisputeAction] = useState<'flag' | 'uphold' | 'partial_waive' | 'waive'>('flag');
  const [disputeWaiverAmount, setDisputeWaiverAmount] = useState('');
  const [disputeNotes, setDisputeNotes] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, list] = await Promise.all([
        getOverstaySummary(token),
        getOverstayCases(token, {
          status: filterTab === 'open' || filterTab === 'Disputed' || filterTab === 'closed' ? filterTab : undefined,
          paymentStatus: filterTab === 'PaymentDue' ? 'PaymentDue' : undefined,
          search: searchQuery.trim() || undefined,
          page,
          pageSize,
        }),
      ]);
      setSummary(sum);
      setCases(list.items);
      setTotalCount(list.totalCount);
      setTotalPages(Math.max(1, list.totalPages));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load overstay enforcement data.');
    } finally {
      setLoading(false);
    }
  }, [filterTab, page, pageSize, searchQuery, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openPolicyModal = () => {
    setPolicyGrace(summary?.gracePeriodMinutes ?? gracePeriodMinutes ?? 15);
    setPolicyMultiplier(summary?.penaltyMultiplier ?? 1.5);
    setPolicyMaxDaily(summary?.maxDailyPenalty ?? 30);
    setShowPolicyModal(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || savingPolicy) return;
    setSavingPolicy(true);
    setError(null);
    try {
      const { message, config } = await updateOverstayPolicy(token, {
        gracePeriodMinutes: policyGrace,
        overstayPenaltyMultiplier: policyMultiplier,
        overstayMaxDailyPenalty: policyMaxDaily,
        hardwareExitLockEnabled: false,
      });
      setShowPolicyModal(false);
      setToast(message);
      onSystemConfigUpdated?.(config);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update overstay policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleRunScan = async () => {
    if (!token || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const { message } = await triggerOverstayScan(token);
      setToast(message);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
      await onRefreshDashboard?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute overstay scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleWarn = async (item: OverstayCaseDto) => {
    if (!token || busyCaseKey) return;
    setBusyCaseKey(`warn-${item.overstayCaseId}`);
    setError(null);
    try {
      const { message } = await dispatchOverstayWarning(token, item.overstayCaseId, true);
      setToast(message);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to dispatch warning.');
    } finally {
      setBusyCaseKey(null);
    }
  };

  const handleCharge = async (item: OverstayCaseDto) => {
    if (!token || busyCaseKey) return;
    setBusyCaseKey(`charge-${item.overstayCaseId}`);
    setError(null);
    try {
      const { message } = await chargeOverstayPenalty(token, item.overstayCaseId);
      setToast(message);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
      await onRefreshDashboard?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to debit overstay penalty.');
    } finally {
      setBusyCaseKey(null);
    }
  };

  const handleConfirmWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !waiveTarget || busyCaseKey) return;
    setBusyCaseKey(`waive-${waiveTarget.overstayCaseId}`);
    setError(null);
    try {
      const parsedAmount = waiveFull ? undefined : Number(waiveAmount);
      if (!waiveFull && (!Number.isFinite(parsedAmount) || (parsedAmount ?? 0) <= 0)) {
        throw new Error('Enter a positive partial waiver amount.');
      }
      const { message } = await waiveOverstayPenalty(token, waiveTarget.overstayCaseId, {
        waiverAmount: parsedAmount,
        reason: waiveReason.trim(),
      });
      setWaiveTarget(null);
      setWaiveReason('');
      setWaiveAmount('');
      setToast(message);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
      await onRefreshDashboard?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply waiver.');
    } finally {
      setBusyCaseKey(null);
    }
  };

  const handleConfirmDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !disputeTarget || busyCaseKey) return;
    setBusyCaseKey(`dispute-${disputeTarget.overstayCaseId}`);
    setError(null);
    try {
      const parsedAmount = disputeAction === 'partial_waive' ? Number(disputeWaiverAmount) : undefined;
      if (disputeAction === 'partial_waive' && (!Number.isFinite(parsedAmount) || (parsedAmount ?? 0) <= 0)) {
        throw new Error('Enter a valid partial waiver amount.');
      }
      const { message } = await reviewOverstayDispute(token, disputeTarget.overstayCaseId, {
        action: disputeAction,
        waiverAmount: parsedAmount,
        notes: disputeNotes.trim(),
      });
      setDisputeTarget(null);
      setDisputeNotes('');
      setDisputeWaiverAmount('');
      setToast(message);
      addActivityLog?.('enforcement', message, 'Admin');
      await loadData();
      await onRefreshDashboard?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review dispute.');
    } finally {
      setBusyCaseKey(null);
    }
  };

  const liveGrace = summary?.gracePeriodMinutes ?? gracePeriodMinutes;
  const worker = summary?.workerStatus;

  return (
    <div id="overstay-enforcement" className="space-y-6">
      <AdminPageHeader
        headingId="enforcement-title"
        title="Overstay enforcement"
        description="Scheduled cron endpoint scanning, Push & SMS warnings, automated 1.5x tariff debiting, penalty waivers, and dispute audit."
        isLoading={loading}
        onRefresh={() => void loadData()}
      >
        <button type="button" onClick={openPolicyModal} className="workspace-button workspace-button--secondary">
          <Settings2 size={15} aria-hidden="true" /> Enforcement Policy
        </button>
        <button
          type="button"
          onClick={() => void handleRunScan()}
          disabled={scanning}
          className="workspace-button workspace-button--primary"
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {scanning ? 'Scanning…' : 'Run Scan Now'}
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

      {/* Top 3 Live Policy & Worker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Live Grace Period Window</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/50">
              <Activity className="h-3 w-3" />
              {worker?.isRunning ? 'Cron Active' : 'Policy Active'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {liveGrace === null ? '—' : `${liveGrace} mins`}
            </span>
            <span className="text-xs text-slate-500 font-medium">Buffer before citation</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            {worker?.lastScanCompletedAtUtc
              ? `Last cron scan ${formatDateTime(worker.lastScanCompletedAtUtc)} (${worker.totalScansCompleted} total scans).`
              : `Triggered via cron endpoint after a ${liveGrace ?? 15}-minute buffer before automated Push & SMS warnings trigger.`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Penalty Hourly Tariff</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/50">
              <ShieldCheck className="h-3 w-3" />
              Auto-escalation Active
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {(summary?.penaltyMultiplier ?? 1.5).toFixed(1)}x Hourly
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Cap {money(summary?.maxDailyPenalty ?? 30)}/day
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Collected {money(summary?.totalCollectedPenalties ?? 0)} · Outstanding {money(summary?.totalOutstandingPenalties ?? 0)} · Waived {money(summary?.totalWaivedPenalties ?? 0)}.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Citation &amp; Dispute Audit</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/50">
              <BellRing className="h-3 w-3" />
              Multi-Channel Alerts
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary?.warningsSentCount ?? 0} Warnings
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {summary?.disputedCount ?? 0} Disputed
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Unpaid overstay penalties block new parking bookings while allowing already-confirmed bookings to proceed normally until settled.
          </p>
        </div>
      </div>

      {/* Live Queue Summary Strip */}
      <AdminSummaryCounts
        items={[
          { label: 'Active Overstays', value: summary?.activeOverstaysCount ?? 0 },
          { label: 'Warnings Sent', value: summary?.warningsSentCount ?? 0 },
          { label: 'Payment Due', value: summary?.paymentDueCount ?? 0 },
          { label: 'Disputed', value: summary?.disputedCount ?? 0 },
          { label: 'Waived / Resolved', value: summary?.waivedOrResolvedCount ?? 0 },
        ]}
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 dark:bg-zinc-900">
          {(
            [
              { id: 'all', label: 'All Cases' },
              { id: 'open', label: 'Open' },
              { id: 'PaymentDue', label: 'Payment Due' },
              { id: 'Disputed', label: 'Disputed' },
              { id: 'closed', label: 'Waived / Resolved' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterTab(tab.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="relative block w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search case ref, plate, driver, bay…"
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      {/* Cases Audit Table */}
      {loading && cases.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading overstay audit queue…
        </div>
      ) : cases.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-center text-slate-500 p-6">
          <ShieldAlert className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold">No overstay violations detected for this filter</p>
          <p className="text-xs text-slate-400 max-w-md">
            The continuous enforcement worker monitors active bookings against Malaysia-time expiration timestamps and ESP32 ultrasonic telemetry every {worker?.intervalSeconds ?? 60} seconds.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="workspace-record-table w-full min-w-[1040px] border-separate border-spacing-0 text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">Case &amp; Booking</th>
                  <th className="border-b border-slate-200 px-4 py-3">Vehicle &amp; Driver</th>
                  <th className="border-b border-slate-200 px-4 py-3">Bay &amp; IoT Telemetry</th>
                  <th className="border-b border-slate-200 px-4 py-3">Overstay &amp; Tariff</th>
                  <th className="border-b border-slate-200 px-4 py-3">Notifications &amp; Status</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">Operator Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {cases.map((item) => {
                  const isClosed = item.status === 'Waived' || item.status === 'Resolved';
                  return (
                    <tr key={item.overstayCaseId} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-slate-900">{item.caseReference}</p>
                        <p className="font-mono text-[10px] text-slate-500">Booking: {item.bookingReference}</p>
                        <p className="mt-1 text-[10px] text-slate-400">Grace ended: {formatDateTime(item.graceEndsAtUtc)}</p>
                        {item.departedAtUtc && (
                          <p className="text-[10px] text-emerald-600">Exited: {formatDateTime(item.departedAtUtc)}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-block rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          {item.vehiclePlate}
                        </span>
                        <p className="mt-1 font-semibold text-slate-800">{item.renterName}</p>
                        <p className="text-[11px] text-slate-400">{item.renterEmail}</p>
                        {item.renterPhone && <p className="font-mono text-[10px] text-slate-500">{item.renterPhone}</p>}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{item.spotLabel}</p>
                        <p className="text-[11px] text-slate-400">{item.propertyName}</p>
                        {item.esp32Serial && (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                            ESP32: {item.esp32Serial} ({item.deviceStatus ?? 'Unknown'})
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {item.overstayMinutes} mins ({item.billableHours} billable hr)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {money(item.baseHourlyRate)} × {item.penaltyMultiplier.toFixed(1)} = {money(item.hourlyPenaltyTariff)}/hr
                        </p>
                        <div className="mt-1 space-y-0.5 text-[11px] tabular-nums">
                          <p>Calculated: <strong>{money(item.calculatedPenaltyAmount)}</strong></p>
                          <p className="text-emerald-600">Debited: {money(item.debitedAmount)}</p>
                          {item.waivedAmount > 0 && <p className="text-blue-600">Waived: {money(item.waivedAmount)}</p>}
                          {item.remainingDueAmount > 0 && (
                            <p className="font-bold text-rose-600">Due: {money(item.remainingDueAmount)}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeTone(item.status)}`}>
                            {item.status}
                          </span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeTone(item.paymentStatus)}`}>
                            {item.paymentStatus}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Push/Email: {item.pushWarningSentAtUtc ? formatDateTime(item.pushWarningSentAtUtc) : 'Pending'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          SMS: {item.smsDeliveryStatus ?? 'Not sent'}
                        </p>
                        {item.resolutionNotes && (
                          <p className="max-w-xs text-[10px] italic text-slate-500">{item.resolutionNotes}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col items-end gap-1.5">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleWarn(item)}
                              disabled={busyCaseKey === `warn-${item.overstayCaseId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                            >
                              <BellRing className="h-3 w-3" /> Warn
                            </button>
                            {!isClosed && item.remainingDueAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => void handleCharge(item)}
                                disabled={busyCaseKey === `charge-${item.overstayCaseId}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                              >
                                <DollarSign className="h-3 w-3" /> Debit
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDisputeTarget(item);
                                setDisputeAction('flag');
                                setDisputeWaiverAmount('');
                                setDisputeNotes('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Gavel className="h-3 w-3" /> Dispute
                            </button>
                            {item.calculatedPenaltyAmount - item.waivedAmount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWaiveTarget(item);
                                  setWaiveFull(true);
                                  setWaiveAmount('');
                                  setWaiveReason('');
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Waive
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>Showing {cases.length} of {totalCount} overstay case(s)</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-20 text-center font-semibold text-slate-700">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MODAL: ENFORCEMENT POLICY */}
      {showPolicyModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Overstay Enforcement Policy</h3>
              <button type="button" onClick={() => setShowPolicyModal(false)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSavePolicy(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Grace Period (minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={policyGrace}
                  onChange={(e) => setPolicyGrace(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Hourly Penalty Multiplier (e.g. 1.5x)</label>
                <input
                  type="number"
                  min={1.0}
                  max={5.0}
                  step={0.1}
                  value={policyMultiplier}
                  onChange={(e) => setPolicyMultiplier(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Daily Penalty Cap (RM)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  value={policyMaxDaily}
                  onChange={(e) => setPolicyMaxDaily(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPolicyModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
                  Cancel
                </button>
                <button type="submit" disabled={savingPolicy} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
                  <Save className="h-3.5 w-3.5" /> {savingPolicy ? 'Saving…' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: WAIVE PENALTY */}
      {waiveTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Waive Overstay Penalty</h3>
              <button type="button" onClick={() => setWaiveTarget(null)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmWaive(e)} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1 dark:bg-white/[0.04]">
                <p className="font-mono font-bold text-slate-800 dark:text-white">{waiveTarget.caseReference} · {waiveTarget.vehiclePlate}</p>
                <p className="text-slate-600 dark:text-zinc-300">
                  Calculated {money(waiveTarget.calculatedPenaltyAmount)} · Debited {money(waiveTarget.debitedAmount)} · Max Waivable {money(Math.max(0, waiveTarget.calculatedPenaltyAmount - waiveTarget.waivedAmount))}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWaiveFull(true)}
                  className={`flex-1 rounded-xl border px-3 py-2 font-bold ${waiveFull ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-zinc-300'}`}
                >
                  Full Waiver
                </button>
                <button
                  type="button"
                  onClick={() => setWaiveFull(false)}
                  className={`flex-1 rounded-xl border px-3 py-2 font-bold ${!waiveFull ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-zinc-300'}`}
                >
                  Partial Waiver
                </button>
              </div>

              {!waiveFull && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Waiver Amount (RM)</label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.5}
                    required
                    value={waiveAmount}
                    onChange={(e) => setWaiveAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Audit Reason (refunds wallet if already debited)</label>
                <textarea
                  required
                  rows={3}
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="e.g. Sensor calibration delay confirmed by operator"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setWaiveTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
                  Cancel
                </button>
                <button type="submit" disabled={busyCaseKey?.startsWith('waive-')} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
                  Confirm Waiver
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: DISPUTE REVIEW */}
      {disputeTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#141417]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Dispute Review Audit</h3>
              <button type="button" onClick={() => setDisputeTarget(null)} aria-label="Close modal" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmDispute(e)} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Decision</label>
                <select
                  value={disputeAction}
                  onChange={(e) => setDisputeAction(e.target.value as 'flag' | 'uphold' | 'partial_waive' | 'waive')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                >
                  <option value="flag">Flag as Disputed (Pause auto-debit)</option>
                  <option value="uphold">Uphold Penalty</option>
                  <option value="partial_waive">Partial Waiver &amp; Resolve</option>
                  <option value="waive">Full Waiver &amp; Refund</option>
                </select>
              </div>

              {disputeAction === 'partial_waive' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Partial Waiver Amount (RM)</label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.5}
                    required
                    value={disputeWaiverAmount}
                    onChange={(e) => setDisputeWaiverAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">Operator Investigation Notes</label>
                <textarea
                  required
                  rows={3}
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  placeholder="Document evidence reviewed, driver communication, or ticket link"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-[#1c1c1f] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDisputeTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">
                  Cancel
                </button>
                <button type="submit" disabled={busyCaseKey?.startsWith('dispute-')} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
                  Record Decision
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
