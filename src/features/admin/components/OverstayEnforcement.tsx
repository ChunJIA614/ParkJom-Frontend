import React from 'react';
import { ShieldAlert, Clock, AlertTriangle, ShieldCheck, Car, BellRing, Lock } from 'lucide-react';
import ServiceUpcoming from '@/components/ui/ServiceUpcoming';
import type { OverstayRecord } from '../types';

interface OverstayEnforcementProps {
  overstays?: OverstayRecord[];
  setOverstays?: React.Dispatch<React.SetStateAction<OverstayRecord[]>>;
  addActivityLog?: (type: string, message: string, user: string) => void;
  /** Grace period minutes dynamically loaded from SystemConfiguration table. */
  gracePeriodMinutes: number | null;
}

export default function OverstayEnforcement({
  gracePeriodMinutes
}: OverstayEnforcementProps) {
  return (
    <div id="overstay-enforcement" className="space-y-6">
      {/* Title */}
      <div>
        <h2 id="enforcement-title" className="text-2xl font-bold text-slate-800 tracking-tight">Overstay Detection &amp; Enforcement</h2>
        <p className="text-slate-500 text-sm">Monitor parked vehicles exceeding their bookings. Calculate automated fine schedules and issue reminders.</p>
      </div>

      {/* Live Configuration Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Live Grace Period Window</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
              <ShieldCheck className="h-3 w-3" />
              Active System Policy
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{gracePeriodMinutes === null ? '—' : `${gracePeriodMinutes} mins`}</span>
            <span className="text-xs text-slate-500 font-medium">Buffer before citation</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            {gracePeriodMinutes === null
              ? 'Loading configured grace period...'
              : `Drivers are granted an official ${gracePeriodMinutes}-minute buffer post-reservation before overstay penalties trigger.`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2 opacity-80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Penalty Hourly Tariff</span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Upcoming</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-400">1.5x Hourly</span>
            <span className="text-xs text-slate-400 font-medium">Auto-escalation</span>
          </div>
          <p className="text-[11px] text-slate-400">Automated recurring billing penalties computed from vehicle bay departure timestamps.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-2 opacity-80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Hardware Exit Lock</span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Upcoming</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-400">IoT Solenoid</span>
            <span className="text-xs text-slate-400 font-medium">Bollard Gate Lock</span>
          </div>
          <p className="text-[11px] text-slate-400">Barrier exit lock requiring penalty settlement prior to physical gate release.</p>
        </div>
      </div>

      {/* Service Upcoming Banner */}
      <ServiceUpcoming
        icon={ShieldAlert}
        title="Automated Overstay Detection &amp; Citations"
        badge="Service Upcoming"
        description="The automated overstay scanning engine and citation dispatch system are currently under active development. This background worker will continuously cross-reference vehicle presence with active booking expiration timestamps."
        plannedFeatures={[
          "Continuous background worker scanning for expired bookings (Booking.EndTime < now)",
          "Automated multi-channel push & SMS warning dispatches upon grace period expiration",
          "Automated ledger debiting of calculated overstay penalty tariffs",
          "Operator audit portal for manual dispute review, penalty waivers, and security releases"
        ]}
        technicalNote="Requires the background worker service and /api/admin/overstays endpoints to be integrated into the .NET host application."
      />
    </div>
  );
}
