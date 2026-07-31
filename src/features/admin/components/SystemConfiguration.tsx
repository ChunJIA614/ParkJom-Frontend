import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sliders, Clock, Shield, RefreshCw, CheckCircle,
  Wifi, ArrowLeft, Save, Lock, AlertTriangle
} from 'lucide-react';

interface SystemConfigurationProps {
  systemConfig: { commissionRate: number; gracePeriodMinutes: number };
  setSystemConfig: React.Dispatch<React.SetStateAction<{ commissionRate: number; gracePeriodMinutes: number }>>;
  stats: { platformCommission: number; onlineBollardsRate: number };
  setStats: React.Dispatch<React.SetStateAction<any>>;
  onNavigateHome: () => void;
}

export default function SystemConfiguration({
  systemConfig,
  setSystemConfig,
  stats,
  setStats,
  onNavigateHome
}: SystemConfigurationProps) {
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleUpdateConfig = (field: 'commissionRate' | 'gracePeriodMinutes', value: number) => {
    setIsUpdatingConfig(true);
    setTimeout(() => {
      setSystemConfig(prev => {
        const next = { ...prev, [field]: value };
        if (field === 'commissionRate') {
          const originalCommissionPercent = prev.commissionRate;
          const originalCommissionStat = stats.platformCommission;
          const grossRevenue = originalCommissionStat / (originalCommissionPercent / 100);
          const newCommissionStat = grossRevenue * (value / 100);
          setStats((s: any) => ({
            ...s,
            platformCommission: Math.round(newCommissionStat * 100) / 100
          }));
        }
        return next;
      });
      setIsUpdatingConfig(false);
      setSuccessToast(`System configuration for ${field === 'commissionRate' ? 'Commission Rate' : 'Overstay Grace Period'} updated successfully!`);
      setTimeout(() => setSuccessToast(null), 3000);
    }, 400);
  };

  const handleResetDefaults = () => {
    setConfirmReset(false);
    setIsUpdatingConfig(true);
    setTimeout(() => {
      setSystemConfig({ commissionRate: 15, gracePeriodMinutes: 15 });
      setIsUpdatingConfig(false);
      setSuccessToast('System configuration reset to factory defaults successfully!');
      setTimeout(() => setSuccessToast(null), 3000);
    }, 400);
  };

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
            <p className="text-slate-500 text-sm ml-7">Global platform parameters — changes apply system-wide immediately.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
          <Lock className="w-3.5 h-3.5" />
          Restricted Access
        </div>
      </div>

      {/* Toast Alert */}
      {successToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between text-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        </motion.div>
      )}

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Caution: System-Wide Impact</p>
          <p className="text-xs text-amber-700 mt-1">
            Modifying these parameters affects all transactions, bookings, and enforcement rules across the platform.
            Changes are applied in real-time and cannot be undone automatically.
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
            {isUpdatingConfig && <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />}
          </div>

          <div className="space-y-4">
            <div className="text-center py-4">
              <span className="text-5xl font-black text-[#1E293B] font-mono">{systemConfig.commissionRate}%</span>
              <p className="text-xs text-slate-500 mt-2">Current platform service fee per booking</p>
            </div>

            <input
              type="range"
              min="5"
              max="30"
              value={systemConfig.commissionRate}
              onChange={(e) => handleUpdateConfig('commissionRate', parseInt(e.target.value))}
              className="w-full accent-[#2563EB] h-2 bg-slate-100 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5%</span>
              <span>15% (Default)</span>
              <span>30%</span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Projected Monthly Commission</span>
                <span className="font-bold text-[#1E293B]">RM {(stats.platformCommission * (systemConfig.commissionRate / 15)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Current Rate</span>
                <span className="font-bold text-[#2563EB]">{systemConfig.commissionRate}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Effective Commission</span>
                <span className="font-bold text-emerald-600">RM {stats.platformCommission.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates platform deductions on each booking transaction. Higher rates increase commission revenue
              but may reduce owner participation. Recommended range: <strong className="text-slate-600">10% - 20%</strong>.
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
            {isUpdatingConfig && <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />}
          </div>

          <div className="space-y-4">
            <div className="text-center py-4">
              <span className="text-5xl font-black text-[#1E293B] font-mono">{systemConfig.gracePeriodMinutes} <span className="text-2xl text-slate-400">mins</span></span>
              <p className="text-xs text-slate-500 mt-2">Buffer time before overstay penalties apply</p>
            </div>

            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={systemConfig.gracePeriodMinutes}
              onChange={(e) => handleUpdateConfig('gracePeriodMinutes', parseInt(e.target.value))}
              className="w-full accent-[#2563EB] h-2 bg-slate-100 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5 min</span>
              <span>15 min (Default)</span>
              <span>30 min</span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
              <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Penalty Calculation Example
              </div>
              <div className="text-xs text-slate-500 mt-1 space-y-1">
                <p>• Vehicle overstays by 23 minutes</p>
                <p>• Grace period: <strong className="text-slate-700">{systemConfig.gracePeriodMinutes} mins</strong></p>
                <p>• Chargeable overstay: <strong className="text-slate-700">{Math.max(0, 23 - systemConfig.gracePeriodMinutes)} mins</strong></p>
                <p>• Estimated penalty: <strong className="text-amber-600">RM {Math.max(0, (23 - systemConfig.gracePeriodMinutes) * 0.50).toFixed(2)}</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Allocated buffer minutes before the violation engine flags a vehicle and imposes overstay penalties.
              Lower values increase enforcement strictness.
            </p>
          </div>
        </div>
      </div>

      {/* IoT Deployment Diagnostics & Reset */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IoT Status */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block flex items-center gap-2">
            <Wifi className="w-4 h-4 text-[#2563EB]" />
            IoT Deployment Diagnostics
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">ESP32 Online Rate</span>
              <span className="text-xl font-bold text-emerald-600">{stats.onlineBollardsRate}%</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Avg. Signal RSSI</span>
              <span className="text-xl font-bold text-[#1E293B]">-69 dBm</span>
            </div>
          </div>
        </div>

        {/* Config History */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Configuration Version</span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Last Modified</span>
              <span className="font-semibold text-slate-700">Today, 07:45 AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Modified By</span>
              <span className="font-semibold text-slate-700">Operator Admin</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Config Version</span>
              <span className="font-semibold text-slate-700 font-mono">v2.1.4</span>
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Danger Zone</span>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full border border-rose-200 hover:border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs py-2.5 rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              Reset to Factory Defaults
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-rose-600 font-medium">Are you sure? This will reset all parameters to defaults.</p>
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
