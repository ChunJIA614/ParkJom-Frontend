import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Shield, Radio, Landmark, Search, Clock, 
  Plus, Download, Filter, HelpCircle, Activity, 
  ShieldCheck, Check, AlertCircle, AlertOctagon, User, ArrowRight
} from 'lucide-react';

interface ActivityLog {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  user: string;
}

interface SystemAuditProps {
  activityLogs: ActivityLog[];
  addActivityLog: (type: string, message: string, user: string) => void;
}

type FilterType = 'all' | 'governance' | 'iot' | 'financial';

export default function SystemAudit({ activityLogs, addActivityLog }: SystemAuditProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom manual entry state
  const [newLogMessage, setNewLogMessage] = useState('');
  const [newLogType, setNewLogType] = useState('governance');
  const [newLogUser, setNewLogUser] = useState('Admin Operator');
  
  // Export button states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Helper mapping
  const getCategory = (type: string): FilterType => {
    const t = type.toLowerCase();
    if (t === 'governance' || t === 'dispute') return 'governance';
    if (t === 'bollard_state' || t === 'overstay' || t === 'iot') return 'iot';
    return 'financial'; // 'system', 'financial'
  };

  // Filter and search activity logs
  const filteredLogs = activityLogs.filter(log => {
    const category = getCategory(log.type);
    const matchesFilter = activeFilter === 'all' || category === activeFilter;
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (log.user && log.user.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          log.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate statistics for the badges and summary cards
  const totalCount = activityLogs.length;
  const governanceCount = activityLogs.filter(log => getCategory(log.type) === 'governance').length;
  const iotCount = activityLogs.filter(log => getCategory(log.type) === 'iot').length;
  const financialCount = activityLogs.filter(log => getCategory(log.type) === 'financial').length;

  const handleSimulateLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogMessage.trim()) return;
    
    // Call the parent state adder
    addActivityLog(newLogType, newLogMessage, newLogUser);
    setNewLogMessage('');
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportSuccess(false);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }, 1500);
  };

  // Helper to get styled attributes for timeline nodes
  const getLogVisuals = (type: string) => {
    const cat = getCategory(type);
    switch (cat) {
      case 'governance':
        return {
          icon: Shield,
          color: 'text-[#2563EB]',
          bgColor: 'bg-[#2563EB]/5',
          borderColor: 'border-[#2563EB]/10',
          badgeText: 'Governance Operations'
        };
      case 'iot':
        return {
          icon: Radio,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-100',
          badgeText: 'IoT & Telemetry'
        };
      case 'financial':
        return {
          icon: Landmark,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-100',
          badgeText: 'Financial System'
        };
    }
  };

  return (
    <div id="system-audit-root" className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="audit-title" className="text-2xl font-bold text-[#1E293B] tracking-tight font-sans">
            System Security & Audit Trail
          </h2>
          <p className="text-[#64748B] text-sm">
            Real-time, immutable operations ledger recording all operator overrides, compliance reviews, and hardware handshakes.
          </p>
        </div>

        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="self-start sm:self-center px-4 py-2 border border-slate-200 hover:border-slate-300 text-[#1E293B] bg-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0 shadow-xs"
        >
          {isExporting ? (
            <>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: 'linear', duration: 1 }}
              >
                <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
              </motion.div>
              <span>Generating CSV...</span>
            </>
          ) : exportSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Report Downloaded!</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Export Secure Audit Log</span>
            </>
          )}
        </button>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Total Tracked Events</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#1E293B]">{totalCount}</span>
            <span className="text-xs text-slate-500">Live indexed</span>
          </div>
          <p className="text-[10px] text-slate-400">Total handshakes, commands, and reviews captured this cycle.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Governance Events</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#2563EB]">{governanceCount}</span>
            <span className="text-xs text-[#2563EB] font-semibold">{Math.round((governanceCount / (totalCount || 1)) * 100)}% ratio</span>
          </div>
          <p className="text-[10px] text-slate-400">Host approvals, document validations, and operator enforcement.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Hardware Overrides</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{iotCount}</span>
            <span className="text-xs text-emerald-500 font-semibold">{iotCount} barrier actions</span>
          </div>
          <p className="text-[10px] text-slate-400">Automatic/manual bollard triggers, overstay checks, and state syncs.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">Ledger Integrity</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              100%
            </span>
            <span className="text-xs text-emerald-500 font-semibold">Verified</span>
          </div>
          <p className="text-[10px] text-slate-400">Cryptographically signed operations feed, matching compliance criteria.</p>
        </div>
      </div>

      {/* Main Filter and List Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Timeline list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-5">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === 'all' 
                    ? 'bg-[#2563EB]/5 text-[#2563EB] border border-[#2563EB]/10' 
                    : 'text-[#64748B] hover:bg-slate-50 border border-transparent'
                }`}
              >
                All Events ({totalCount})
              </button>
              <button 
                onClick={() => setActiveFilter('governance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === 'governance' 
                    ? 'bg-[#2563EB]/5 text-[#2563EB] border border-[#2563EB]/10' 
                    : 'text-[#64748B] hover:bg-slate-50 border border-transparent'
                }`}
              >
                Governance ({governanceCount})
              </button>
              <button 
                onClick={() => setActiveFilter('iot')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === 'iot' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : 'text-[#64748B] hover:bg-slate-50 border border-transparent'
                }`}
              >
                IoT Bollards ({iotCount})
              </button>
              <button 
                onClick={() => setActiveFilter('financial')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === 'financial' 
                    ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                    : 'text-[#64748B] hover:bg-slate-50 border border-transparent'
                }`}
              >
                Financial ({financialCount})
              </button>
            </div>

            {/* Simple Search bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search audit trail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-52 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          {/* Timeline Feed */}
          {filteredLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-[#64748B] space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold">No audit matches found</p>
              <p className="text-[11px] text-slate-400">Try checking alternative categories or clearing your search phrase.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-100 space-y-6 py-2 ml-2">
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => {
                  const design = getLogVisuals(log.type);
                  const Icon = design.icon;

                  return (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="relative group"
                    >
                      {/* Left vertical marker node */}
                      <span className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full border bg-white flex items-center justify-center shadow-xs transition-all group-hover:scale-105 ${design.color} ${design.borderColor}`}>
                        <Icon className="w-3 h-3" />
                      </span>

                      {/* Timeline card content */}
                      <div className="space-y-1 bg-slate-50/40 border border-slate-100 rounded-xl p-3.5 hover:bg-slate-50/90 transition-all duration-150">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs font-semibold text-[#1E293B] leading-relaxed">
                            {log.message}
                          </p>
                          <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            {log.timestamp}
                          </span>
                        </div>

                        {/* Badges footer */}
                        <div className="flex items-center gap-2 pt-1 text-[10px]">
                          <span className={`px-2 py-0.2 rounded-full border text-[9px] font-semibold ${design.bgColor} ${design.color} ${design.borderColor}`}>
                            {design.badgeText} ({log.type})
                          </span>
                          
                          {log.user && (
                            <span className="text-slate-400 flex items-center gap-1">
                              • <User className="w-3 h-3" />
                              <span className="font-medium text-slate-500">{log.user}</span>
                            </span>
                          )}

                          <span className="text-slate-400 ml-auto font-mono text-[9px]">ID: {log.id}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right 1 Column: Actions and configuration metadata */}
        <div className="space-y-6">
          
          {/* Simulate Action form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Simulate Audit Entry</h3>
            </div>
            
            <p className="text-xs text-[#64748B]">
              Inject custom manual log events to test live system update parameters and security logging capabilities.
            </p>

            <form onSubmit={handleSimulateLog} className="space-y-3.5">
              {/* Type Selection */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Activity Log Type</label>
                <select 
                  value={newLogType}
                  onChange={(e) => setNewLogType(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
                >
                  <option value="governance">Governance (Approval, Document Verify)</option>
                  <option value="dispute">Dispute (Support Ticket, Resolution)</option>
                  <option value="bollard_state">Bollard State (Command Override)</option>
                  <option value="overstay">Overstay (Enforcement Warning)</option>
                  <option value="system">System (IBG Payout, Cron cycle)</option>
                </select>
              </div>

              {/* Actor/User */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Triggering Operator</label>
                <input 
                  type="text" 
                  value={newLogUser}
                  onChange={(e) => setNewLogUser(e.target.value)}
                  placeholder="e.g. Admin (Ch Chun Jia)"
                  className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              {/* Message text */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Audit Log Message</label>
                <textarea 
                  rows={3}
                  value={newLogMessage}
                  onChange={(e) => setNewLogMessage(e.target.value)}
                  placeholder="e.g., Manual physical patrol completed. Confirmed SS15 Bollard A-03 raised successfully."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] resize-none leading-relaxed"
                />
              </div>

              <button 
                type="submit"
                disabled={!newLogMessage.trim()}
                className="w-full py-2.5 bg-[#2563EB] text-white font-semibold rounded-lg text-xs hover:bg-[#2563EB]/90 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Commit Entry to Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Compliance & Policy Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-[#1E293B]">Logging Compliance Standard</h4>
            </div>
            
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              This panel registers actions with strict compliance mappings based on standards set in the Personal Data Protection Act (PDPA) & Smart City IoT Security Protocols.
            </p>

            <ul className="space-y-2 text-[11px] text-slate-500 pt-1">
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>**Retention Cycle**: Logs are held securely in cloud memory for 90 days before cold storage.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>**Immutability**: Log mutations are forbidden; any adjustments require corrective contra entries.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>**Audit Trail Accuracy**: Every record ties directly to authenticated operator key pairs and system timers.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
