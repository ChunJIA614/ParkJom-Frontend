import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sliders, Clock, RefreshCw, CheckCircle,
  Wifi, ArrowLeft, Save, Lock, AlertTriangle, RotateCcw
} from 'lucide-react';
import { getSystemConfig, updateSystemConfig } from '../api/systemConfigApi';
import type { SystemConfig } from '../types';

/**
 * Commission rate and overstay grace period.
 *
 * Values are read from GET /api/admin/system-config and written with PUT.
 * Edits are staged locally and only committed when Save is pressed — a slider
 * drag must not fire one write per pixel.
 */

/** Mirrors SystemConfigurationService defaults on the backend. */
const PLATFORM_DEFAULT_COMMISSION_RATE = 10;
const PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES = 15;

interface SystemConfigurationProps {
  token: string;
  stats: { platformCommission: number; onlineBollardsRate: number; totalBollards: number; onlineBollards: number };
  onNavigateHome: () => void;
  onSaved?: (config: SystemConfig) => void;
}

export default function SystemConfiguration({
  token,
  stats,
  onNavigateHome,
  onSaved,
}: SystemConfigurationProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Draft values — what the sliders show before Save.
  const [draftCommission, setDraftCommission] = useState(PLATFORM_DEFAULT_COMMISSION_RATE);
  const [draftGrace, setDraftGrace] = useState(PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!token) {
      setLoadError('Your admin session is missing an authorization token.');
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await getSystemConfig(token);
      setConfig(loaded);
      setDraftCommission(loaded.commissionRate);
      setDraftGrace(loaded.gracePeriodMinutes);
    } catch (error) {
      setLoadError(error instanceof Error
        ? error.message
        : 'Unable to load the system configuration.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const commit = useCallback(async (
    payload: { commissionRate?: number; gracePeriodMinutes?: number },
    successMessage: string,
  ) => {
    if (!token) {
      setSaveError('Your admin session is missing an authorization token.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateSystemConfig(token, payload);
      setConfig(updated);
      setDraftCommission(updated.commissionRate);
      setDraftGrace(updated.gracePeriodMinutes);
      setSuccessToast(successMessage);
      onSaved?.(updated);
    } catch (error) {
      setSaveError(error instanceof Error
        ? error.message
        : 'Unable to save the system configuration.');
      // Re-sync so the sliders never keep a value the server rejected.
      void loadConfig();
    } finally {
      setIsSaving(false);
    }
  }, [loadConfig, onSaved, token]);

  const hasChanges = Boolean(config)
    && (draftCommission !== config!.commissionRate || draftGrace !== config!.gracePeriodMinutes);

  const handleSave = () => {
    if (!config || !hasChanges) return;
    const changes: { commissionRate?: number; gracePeriodMinutes?: number } = {};
    const parts: string[] = [];
    if (draftCommission !== config.commissionRate) {
      changes.commissionRate = draftCommission;
      parts.push(`commission rate ${config.commissionRate}% → ${draftCommission}%`);
    }
    if (draftGrace !== config.gracePeriodMinutes) {
      changes.gracePeriodMinutes = draftGrace;
      parts.push(`grace period ${config.gracePeriodMinutes} → ${draftGrace} min`);
    }
    void commit(changes, `Saved: ${parts.join('; ')}.`);
  };

  const handleResetDefaults = () => {
    setConfirmReset(false);
    void commit(
      {
        commissionRate: PLATFORM_DEFAULT_COMMISSION_RATE,
        gracePeriodMinutes: PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES,
      },
      `Reset to platform defaults: ${PLATFORM_DEFAULT_COMMISSION_RATE}% commission, ${PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES} min grace period.`,
    );
  };

  const updatedAtLabel = config?.updatedAt
    ? new Date(config.updatedAt).toLocaleString()
    : 'Not recorded';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateHome}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Configuration</h2>
            </div>
            <p className="text-slate-500 text-sm ml-7">
              Global platform parameters. Saving changes the rate applied to every future booking quote.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadConfig()}
            disabled={isLoading || isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <div className="flex items-center gap-2 text-xs font-mono bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
            <Lock className="w-3.5 h-3.5" />
            Restricted Access
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">The current configuration could not be read</p>
            <p className="text-xs mt-1 leading-relaxed">{loadError}</p>
            <p className="text-xs mt-1 text-rose-600">
              Editing is disabled until the server values are known, so nothing is overwritten blind.
            </p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">The change was not saved</p>
            <p className="text-xs mt-1 leading-relaxed">{saveError}</p>
          </div>
        </div>
      )}

      {successToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </motion.div>
      )}

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Caution: System-Wide Impact</p>
          <p className="text-xs text-amber-700 mt-1">
            The commission rate is copied onto each booking quote when it is created, so existing
            quotes and completed bookings keep the rate they were priced at. New quotes use the rate
            you save here.
          </p>
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission Rate Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-base font-semibold text-[#1E293B]">Commission Rate</h3>
            </div>
            {isSaving && <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />}
          </div>

          <div className="space-y-4">
            <div className="text-center py-4">
              <span className="text-5xl font-black text-[#1E293B] font-mono">{draftCommission}%</span>
              <p className="text-xs text-slate-500 mt-2">
                {config
                  ? <>Saved rate: <strong className="text-slate-700">{config.commissionRate}%</strong></>
                  : 'Current platform service fee per booking'}
              </p>
            </div>

            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={draftCommission}
              disabled={!config || isSaving}
              onChange={(e) => setDraftCommission(parseInt(e.target.value, 10))}
              className="w-full accent-[#2563EB] h-2 bg-slate-100 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Commission rate percentage"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0%</span>
              <span>{PLATFORM_DEFAULT_COMMISSION_RATE}% (Default)</span>
              <span>50%</span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Commission collected to date</span>
                <span className="font-bold text-[#1E293B]">RM {stats.platformCommission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Rate applied to new quotes</span>
                <span className="font-bold text-[#2563EB]">{hasChanges ? `${draftCommission}% (unsaved)` : `${draftCommission}%`}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Platform deduction on each booking. Higher rates raise commission revenue but reduce
              owner payout per booking. Recommended range: <strong className="text-slate-600">10% - 20%</strong>.
            </p>
          </div>
        </div>

        {/* Grace Period Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#2563EB]" />
              <h3 className="text-base font-semibold text-[#1E293B]">Overstay Grace Period</h3>
            </div>
            {isSaving && <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />}
          </div>

          <div className="space-y-4">
            <div className="text-center py-4">
              <span className="text-5xl font-black text-[#1E293B] font-mono">
                {draftGrace} <span className="text-2xl text-slate-400">mins</span>
              </span>
              <p className="text-xs text-slate-500 mt-2">
                {config
                  ? <>Saved value: <strong className="text-slate-700">{config.gracePeriodMinutes} mins</strong></>
                  : 'Buffer time before overstay penalties apply'}
              </p>
            </div>

            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={draftGrace}
              disabled={!config || isSaving}
              onChange={(e) => setDraftGrace(parseInt(e.target.value, 10))}
              className="w-full accent-[#2563EB] h-2 bg-slate-100 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Overstay grace period in minutes"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 min</span>
              <span>{PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES} min (Default)</span>
              <span>60 min</span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Penalty Calculation Example
              </div>
              <div className="text-xs text-slate-500 mt-1 space-y-1">
                <p>• Vehicle overstays by 23 minutes</p>
                <p>• Grace period: <strong className="text-slate-700">{draftGrace} mins</strong></p>
                <p>• Chargeable overstay: <strong className="text-slate-700">{Math.max(0, 23 - draftGrace)} mins</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Buffer minutes before the violation engine flags a vehicle. Lower values increase
              enforcement strictness.
            </p>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {hasChanges
            ? 'You have unsaved changes.'
            : config
              ? `Configuration matches the server${config.updatedByName ? ` · last saved by ${config.updatedByName}` : ''}.`
              : 'Waiting for the server configuration.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!config) return;
              setDraftCommission(config.commissionRate);
              setDraftGrace(config.gracePeriodMinutes);
            }}
            disabled={!hasChanges || isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !config}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* IoT Deployment Diagnostics & Reset */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IoT Status */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
            <Wifi className="w-4 h-4 text-[#2563EB]" />
            Bollard Deployment
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Online rate</span>
              <span className="text-xl font-bold text-emerald-600">{stats.onlineBollardsRate}%</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Online / total</span>
              <span className="text-xl font-bold text-[#1E293B]">
                {stats.onlineBollards}<span className="text-sm text-slate-400">/{stats.totalBollards}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Config provenance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Configuration Record</span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Last saved</span>
              <span className="font-semibold text-slate-700 text-right">{updatedAtLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Saved by</span>
              <span className="font-semibold text-slate-700 text-right">
                {config?.updatedByName || (config?.updatedByUserId ? `User #${config.updatedByUserId}` : 'Not recorded')}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 shrink-0">Source</span>
              <span className="font-semibold text-slate-700 text-right font-mono">api/admin/system-config</span>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Danger Zone</span>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={!config || isSaving}
              className="w-full border border-rose-200 hover:border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs py-2.5 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Platform Defaults
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-rose-600 font-medium">
                Reset to {PLATFORM_DEFAULT_COMMISSION_RATE}% commission and {PLATFORM_DEFAULT_GRACE_PERIOD_MINUTES} min grace period?
                This is written to the server immediately.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetDefaults}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 rounded-lg transition-colors"
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-bold text-xs py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
