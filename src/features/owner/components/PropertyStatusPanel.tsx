import React from 'react';
import { motion } from 'motion/react';
import {
  Clock, CheckCircle2, XCircle, FileSearch, Building,
  CalendarClock, AlertTriangle, ChevronRight
} from 'lucide-react';
import { ParkingBay } from '../types';

interface PropertyStatusPanelProps {
  bays: ParkingBay[];
  baysLoading: boolean;
}

export default function PropertyStatusPanel({ bays, baysLoading }: PropertyStatusPanelProps) {
  // Filter bays that are not Active (i.e., Approved, Pending, or Rejected)
  const approvedBays = bays.filter(b => b.status === 'Approved');
  const pendingBays = bays.filter(b => b.status === 'Pending Verification');
  const rejectedBays = bays.filter(b => b.status === 'Rejected');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-MY', {
        day: 'numeric', month: 'short', year: 'numeric',
      }) + ' · ' + d.toLocaleTimeString('en-MY', {
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending Verification':
        return {
          icon: Clock,
          label: 'Under Review',
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        };
      case 'Rejected':
        return {
          icon: XCircle,
          label: 'Rejected',
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
        };
      default:
        return {
          icon: CheckCircle2,
          label: status,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
        };
    }
  };

  if (baysLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (pendingBays.length === 0 && approvedBays.length === 0 && rejectedBays.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileSearch className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900">Property Registration Status</h3>
        </div>
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-slate-600">All properties are activated</p>
          <p className="text-[11px] text-slate-400 mt-1">
            No pending or rejected registrations at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900">Property Registration Status</h3>
        </div>
        <div className="flex items-center gap-2">
          {pendingBays.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              {pendingBays.length} Pending
            </span>
          )}
          {rejectedBays.length > 0 && (
            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
              {rejectedBays.length} Rejected
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Review</span>
          </div>
          <span className="text-xl font-black text-amber-700">{pendingBays.length}</span>
          <p className="text-[10px] text-amber-600 mt-0.5">Awaiting admin verification</p>
        </div>
        <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Action Required</span>
          </div>
          <span className="text-xl font-black text-rose-700">{rejectedBays.length}</span>
          <p className="text-[10px] text-rose-600 mt-0.5">Resubmit with corrections</p>
        </div>
      </div>

      {/* Pending Bays List */}
      {pendingBays.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Admin Review</p>
          {pendingBays.map((bay, i) => {
            const badge = getStatusBadge(bay.status);
            const Icon = badge.icon;
            return (
              <motion.div
                key={bay.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${badge.border} ${badge.bg} hover:shadow-sm transition-all duration-150`}
              >
                <div className={`p-2 rounded-lg ${badge.iconBg}`}>
                  <Icon className={`w-4 h-4 ${badge.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{bay.propertyName}</p>
                  <p className="text-[10px] text-slate-500">{bay.bayNumber} · {bay.level}</p>
                  {bay.verificationSubmittedAt && (
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                      <CalendarClock className="w-3 h-3" />
                      <span>Submitted {formatDate(bay.verificationSubmittedAt)}</span>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.text} ${badge.iconBg} border ${badge.border} whitespace-nowrap`}>
                  {badge.label}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rejected Bays List */}
      {rejectedBays.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resubmission Required</p>
          {rejectedBays.map((bay, i) => {
            const badge = getStatusBadge(bay.status);
            const Icon = badge.icon;
            return (
              <motion.div
                key={bay.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${badge.border} ${badge.bg} hover:shadow-sm transition-all duration-150`}
              >
                <div className={`p-2 rounded-lg ${badge.iconBg}`}>
                  <Icon className={`w-4 h-4 ${badge.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{bay.propertyName}</p>
                  <p className="text-[10px] text-slate-500">{bay.bayNumber} · {bay.level}</p>
                  <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                    Verification was not approved. Please re-register with corrected documents.
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.text} ${badge.iconBg} border ${badge.border} whitespace-nowrap`}>
                  {badge.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
