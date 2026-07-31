import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Clock, AlertTriangle, Send, ShieldCheck, Lock, 
  RefreshCw, CheckCircle2, UserCheck, Smartphone, DollarSign, Car 
} from 'lucide-react';
import { OverstayRecord } from '../types';

interface OverstayEnforcementProps {
  overstays: OverstayRecord[];
  setOverstays: React.Dispatch<React.SetStateAction<OverstayRecord[]>>;
  addActivityLog: (type: string, message: string, user: string) => void;
  gracePeriodMinutes: number;
}

export default function OverstayEnforcement({ 
  overstays, 
  setOverstays,
  addActivityLog,
  gracePeriodMinutes
}: OverstayEnforcementProps) {
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null);

  const handleSendWarning = (record: OverstayRecord) => {
    setLoadingRecordId(record.id);
    addActivityLog('overstay', `Sending Automated Push Reminder & SMS Alert to driver of vehicle ${record.vehicleNo}`, "System Enforcement Agent");
    
    setTimeout(() => {
      setOverstays(prev => prev.map(o => o.id === record.id ? { ...o, status: 'warning_sent' } : o));
      setLoadingRecordId(null);
      setSuccessToast(`Warning message dispatched successfully to ${record.vehicleNo} (${record.userPhone})`);
      addActivityLog('overstay', `Driver warned via Push Notification & SMS: Overstay buffer of ${gracePeriodMinutes} mins exceeded.`, "Telecom Gateway Confirmation");
      setTimeout(() => setSuccessToast(null), 3000);
    }, 1000);
  };

  const handleImposePenalty = (record: OverstayRecord) => {
    setLoadingRecordId(record.id);
    addActivityLog('overstay', `Issuing official platform citation for ${record.vehicleNo} (Fine: RM ${record.calculatedPenalty.toFixed(2)})`, "Operations Enforcement");

    setTimeout(() => {
      setOverstays(prev => prev.map(o => o.id === record.id ? { ...o, status: 'penalized' } : o));
      setLoadingRecordId(null);
      setSuccessToast(`Penalty citation issued successfully! RM ${record.calculatedPenalty.toFixed(2)} fine added to booking ledger.`);
      addActivityLog('overstay', `Citation registered. Penalized driver of ${record.vehicleNo} with RM ${record.calculatedPenalty.toFixed(2)} penalty fine.`, "Billing DB Sync");
      setTimeout(() => setSuccessToast(null), 3000);
    }, 1200);
  };

  const handleLockBollard = (record: OverstayRecord) => {
    setLoadingRecordId(record.id);
    addActivityLog('bollard_state', `Sent FORCE_LOCK command to ESP32: ${record.location} ${record.bayNumber}`, "Enforcement Override");

    setTimeout(() => {
      setLoadingRecordId(null);
      setSuccessToast(`ESP32 bollard locked in Raised state for ${record.bayNumber} to prevent exit prior to penalty payment.`);
      addActivityLog('bollard_state', `Physical barrier of ${record.bayNumber} raised & locked securely for vehicle enforcement.`, "ESP32 Lock Callback");
      setTimeout(() => setSuccessToast(null), 3000);
    }, 1200);
  };

  const handleResolveOverstay = (record: OverstayRecord) => {
    setLoadingRecordId(record.id);
    addActivityLog('overstay', `Manually auditing and resolving violation for vehicle ${record.vehicleNo}`, "Admin Operator");

    setTimeout(() => {
      setOverstays(prev => prev.map(o => o.id === record.id ? { ...o, status: 'resolved' } : o));
      setLoadingRecordId(null);
      setSuccessToast(`Overstay violation resolved for ${record.vehicleNo}`);
      addActivityLog('overstay', `Violation resolved. Lock released on bay ${record.bayNumber}`, "Enforcement Engine");
      setTimeout(() => setSuccessToast(null), 3000);
    }, 1000);
  };

  return (
    <div id="overstay-enforcement" className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 id="enforcement-title" className="text-2xl font-bold text-slate-800 tracking-tight">Overstay Detection & Enforcement</h2>
        <p className="text-slate-500 text-sm">Monitor parked vehicles exceeding their bookings. Calculate automated fine schedules and issue reminders.</p>
      </div>

      {/* Success Notification */}
      {successToast && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 text-xs font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </motion.div>
      )}

      {/* Info Warning Bar */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold text-amber-800 block">Enforcement System Overview</span>
          <p className="text-amber-700 leading-relaxed">
            The overstay engine scans active bookings via ultrasonic sensors on the ESP32. If a vehicle remains parked past their reservation window and exceeds the global <strong>Grace Period ({gracePeriodMinutes} mins)</strong>, they are automatically placed in the violation queue.
          </p>
        </div>
      </div>

      {/* Main Grid: Overstay Logs & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Overstay Records Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-800">Violation Records Queue</h3>
            </div>
            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded border border-rose-100">Live Active Alerts</span>
          </div>

          <div className="overflow-x-auto">
            {overstays.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No overstay violations currently detected!</div>
            ) : (
              <div className="space-y-4">
                {overstays.map((record) => {
                  const isPendingOperation = loadingRecordId === record.id;
                  
                  return (
                    <div 
                      key={record.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        record.status === 'detected' ? 'bg-rose-50/15 border-rose-200 shadow-xs' :
                        record.status === 'warning_sent' ? 'bg-amber-50/15 border-amber-200' :
                        record.status === 'penalized' ? 'bg-purple-50/10 border-purple-200' :
                        'bg-slate-50/40 border-slate-150 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                        {/* Left Side details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">ID: {record.id}</span>
                            
                            {/* Status badge */}
                            {record.status === 'detected' && (
                              <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">Vehicle Overstaying</span>
                            )}
                            {record.status === 'warning_sent' && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">Driver Warned</span>
                            )}
                            {record.status === 'penalized' && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">Citation Issued</span>
                            )}
                            {record.status === 'resolved' && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">Resolved</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded text-xs font-mono font-bold text-slate-700">
                              <Car className="w-3.5 h-3.5 text-slate-500" />
                              {record.vehicleNo}
                            </div>
                            <div className="text-xs text-slate-600 font-medium">
                              {record.location} <span className="text-[#2563EB] font-bold font-mono">[{record.bayNumber}]</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                            <div>
                              <span className="text-slate-400">Scheduled End:</span>
                              <p className="text-slate-700 font-semibold">{new Date(record.scheduledEndTime).toLocaleTimeString()}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Overstay Elapsed:</span>
                              <p className="text-rose-600 font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {record.currentOverstayMinutes} minutes
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Right side fine / action buttons */}
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">Calculated Violation Fine</span>
                          <span className="text-xl font-extrabold text-slate-800">RM {record.calculatedPenalty.toFixed(2)}</span>
                          
                          {/* Execution overlay */}
                          {isPendingOperation ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] bg-[#2563EB]/5 px-3 py-1.5 rounded-lg border border-[#2563EB]/10">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                              Applying...
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              {record.status === 'detected' && (
                                <button
                                  onClick={() => handleSendWarning(record)}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Send className="w-3 h-3" /> Warn Driver
                                </button>
                              )}

                              {record.status === 'warning_sent' && (
                                <button
                                  onClick={() => handleImposePenalty(record)}
                                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <DollarSign className="w-3 h-3" /> Fine Citation
                                </button>
                              )}

                              {record.status !== 'resolved' && (
                                <>
                                  <button
                                    onClick={() => handleLockBollard(record)}
                                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Lock Barrier in place"
                                  >
                                    <Lock className="w-3 h-3" /> Lock Exit
                                  </button>

                                  <button
                                    onClick={() => handleResolveOverstay(record)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3 h-3" /> Resolve
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Violation Rules & Penalties Guide */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800">Violation Penalty Schedule</h3>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Penalties are structured legally to preserve bay space integrity. When violations persist, physical exit blocking operates as a sovereign security control.
            </p>

            <div className="space-y-3.5 text-xs pt-1">
              <div className="flex items-start gap-2">
                <span className="bg-[#2563EB]/5 text-[#2563EB] font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">Tier 1</span>
                <div>
                  <span className="font-semibold text-slate-700 block">Warning Period</span>
                  <p className="text-[11px] text-slate-500">First {gracePeriodMinutes} mins are covered by buffer. Driver receives push warnings.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">Tier 2</span>
                <div>
                  <span className="font-semibold text-slate-700 block">Flat Administrative Fine</span>
                  <p className="text-[11px] text-slate-500">RM 10.00 base administrative charge applied instantly upon grace period expiration.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded font-mono text-[10px]">Tier 3</span>
                <div>
                  <span className="font-semibold text-slate-700 block">Accumulative Overstay Fee</span>
                  <p className="text-[11px] text-slate-500">RM 2.00 accrued for every 10 additional minutes parked past original booking end.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
