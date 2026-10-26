import React from 'react';
import { Landmark, Receipt, FileSpreadsheet, Percent, ShieldCheck, ArrowDownToLine, Clock } from 'lucide-react';
import ServiceUpcoming from '@/components/ui/ServiceUpcoming';
import type { OwnerPayout, Transaction } from '../types';

interface FinanceSettlementProps {
  payouts?: OwnerPayout[];
  setPayouts?: React.Dispatch<React.SetStateAction<OwnerPayout[]>>;
  transactions?: Transaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addActivityLog?: (type: string, message: string, user: string) => void;
  /** Commission rate dynamically loaded from SystemConfiguration table. */
  commissionRate: number | null;
}

export default function FinanceSettlement({
  commissionRate
}: FinanceSettlementProps) {
  return (
    <div id="finance-settlement" className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 id="finance-title" className="text-2xl font-bold text-slate-800 tracking-tight">Financial Clearing &amp; Settlement</h2>
        <p className="text-slate-500 text-sm">Disburse property owner payouts, monitor commission schedules, and audit platform receipts.</p>
      </div>

      {/* Real Live Commission Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Live Platform Commission</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
              <ShieldCheck className="h-3 w-3" />
              Active System Policy
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600">{commissionRate === null ? '—' : `${commissionRate}%`}</span>
            <span className="text-xs text-slate-500 font-medium">Platform deduction fee</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            {commissionRate === null
              ? 'Loading configured platform fee...'
              : `All completed commuter bookings deduct a ${commissionRate}% platform service fee, persisted in the SystemConfiguration database.`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2 opacity-80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Automated IBG Batches</span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Upcoming</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-400">Scheduled</span>
            <span className="text-xs text-slate-400 font-medium">Twice Weekly</span>
          </div>
          <p className="text-[11px] text-slate-400">Interbank GIRO batch file generation adhering to Bank Negara Malaysia protocols.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2 opacity-80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Settlement Ledger Export</span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Upcoming</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-400">CSV / XLSX</span>
            <span className="text-xs text-slate-400 font-medium">Direct Stream</span>
          </div>
          <p className="text-[11px] text-slate-400">Exportable accounting journal streams for corporate audit and tax compliance.</p>
        </div>
      </div>

      {/* Service Upcoming Banner */}
      <ServiceUpcoming
        icon={Landmark}
        title="Admin Financial Clearing &amp; Settlement System"
        badge="Service Upcoming"
        description="The administrator financial disbursement clearing hub and regulatory accounting export service are currently being finalized. Individual owner-initiated withdrawals are now fully live on the platform; administrative batch clearing and export pipelines are scheduled next."
        plannedFeatures={[
          "Batch processing and clearing of owner withdrawal requests to Malaysian banks (DuitNow / IBG)",
          "Real-time bank clearing webhooks and escrow settlement ledger synchronization",
          "One-click streaming export of financial journals (.CSV and .XLSX) with tax breakdowns",
          "Automated reconciliation between Stripe commuter receipts and owner bank payouts"
        ]}
        technicalNote="Admin settlement endpoints (GET /api/admin/payouts, POST /api/admin/payouts/{id}/process, and /api/admin/settlement/export) are scheduled in Phase 3."
      />
    </div>
  );
}
