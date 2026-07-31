import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, Landmark, CreditCard, Receipt, FileSpreadsheet, 
  Search, ShieldAlert, ArrowDownToLine, RefreshCw, CheckCircle, HelpCircle
} from 'lucide-react';
import { OwnerPayout, Transaction } from '../types';

interface FinanceSettlementProps {
  payouts: OwnerPayout[];
  setPayouts: React.Dispatch<React.SetStateAction<OwnerPayout[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addActivityLog: (type: string, message: string, user: string) => void;
  commissionRate: number;
}

export default function FinanceSettlement({ 
  payouts, 
  setPayouts, 
  transactions, 
  setTransactions,
  addActivityLog,
  commissionRate
}: FinanceSettlementProps) {
  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState<'all' | 'completed' | 'refunded'>('all');
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Financial statistics
  const totalPayoutRequested = payouts.reduce((sum, p) => p.status === 'pending' ? sum + p.amount : sum, 0);
  const totalPayoutCompleted = payouts.reduce((sum, p) => p.status === 'completed' ? sum + p.amount : sum, 0);

  const filteredTx = transactions.filter(tx => {
    const matchesSearch = tx.id.toLowerCase().includes(txSearch.toLowerCase()) || 
                          tx.userEmail.toLowerCase().includes(txSearch.toLowerCase()) || 
                          tx.ownerName.toLowerCase().includes(txSearch.toLowerCase()) ||
                          tx.location.toLowerCase().includes(txSearch.toLowerCase());
    const matchesFilter = txFilter === 'all' || tx.status === txFilter;
    return matchesSearch && matchesFilter;
  });

  const handleProcessPayout = (payout: OwnerPayout) => {
    setProcessingPayoutId(payout.id);
    addActivityLog('system', `Initiating Bank API clearing cycle for ${payout.id} (Amount: RM ${payout.amount})`, "Financial System");
    
    setTimeout(() => {
      setPayouts(prev => prev.map(p => p.id === payout.id ? { ...p, status: 'completed' } : p));
      setProcessingPayoutId(null);
      setSuccessMsg(`Successfully cleared payout ${payout.id} to ${payout.ownerName} (${payout.bankName})`);
      addActivityLog('system', `Completed instant payout ${payout.id} of RM ${payout.amount} to bank account: ${payout.accountNumber}`, "Interbank GIRO (IBG)");
      
      setTimeout(() => setSuccessMsg(null), 4000);
    }, 1800);
  };

  return (
    <div id="finance-settlement" className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="finance-title" className="text-2xl font-bold text-slate-800 tracking-tight">Financial Clearing & Settlement</h2>
          <p className="text-slate-500 text-sm">Disburse property owner payouts, monitor commission schedules, and audit platform receipts.</p>
        </div>
      </div>

      {/* Success Alert toast */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-2 text-xs font-semibold"
        >
          <CheckCircle className="text-emerald-600 w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Commission Percentage (Cut)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{commissionRate}%</span>
            <span className="text-xs text-slate-500 font-medium">Standard peer deduction</span>
          </div>
          <p className="text-[10px] text-slate-400">All transactions incur a {commissionRate}% commission charge processed on reservation checkout.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Owner Payout Claims Pending</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">RM {totalPayoutRequested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-xs text-amber-500 font-semibold font-mono">
              {payouts.filter(p => p.status === 'pending').length} claim requests
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Accumulated earnings requested by hosts awaiting bank ledger clearance.</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Owner Payouts Settled</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">RM {totalPayoutCompleted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-xs text-emerald-500 font-semibold">Processed this cycle</span>
          </div>
          <p className="text-[10px] text-slate-400">Total volume securely cleared through Interbank GIRO (IBG) networks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Payout Claims list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Owner Settlement & Payout Queue</h3>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-100">IBG Ledger Routing</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-1">Payout ID</th>
                  <th className="py-2.5 px-1">Host/Owner</th>
                  <th className="py-2.5 px-1">Remittance Bank details</th>
                  <th className="py-2.5 px-1">Amount</th>
                  <th className="py-2.5 px-1 text-right">Settlement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payouts.map((payout) => {
                  const isPending = payout.status === 'pending';
                  const isProcessing = processingPayoutId === payout.id;

                  return (
                    <tr key={payout.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-1 font-mono text-slate-400">{payout.id}</td>
                      <td className="py-3 px-1">
                        <div className="font-semibold text-slate-800">{payout.ownerName}</div>
                        <div className="text-[10px] text-slate-400">{payout.email}</div>
                      </td>
                      <td className="py-3 px-1">
                        <div className="font-medium text-slate-700">{payout.bankName}</div>
                        <div className="text-[10px] font-mono text-slate-400">Acc: {payout.accountNumber}</div>
                      </td>
                      <td className="py-3 px-1 font-bold text-slate-800">RM {payout.amount.toFixed(2)}</td>
                      <td className="py-3 px-1 text-right">
                        {isProcessing ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] bg-[#2563EB]/5 border border-[#2563EB]/10 px-2.5 py-1 rounded-lg">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Clearing...
                          </div>
                        ) : isPending ? (
                          <button
                            disabled={processingPayoutId !== null}
                            onClick={() => handleProcessPayout(payout)}
                            className="px-2.5 py-1 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowDownToLine className="w-3 h-3" /> Process IBG
                          </button>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Platform Audit Log & Export Summary */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-4.5 h-4.5 text-[#2563EB]" />
            <h3 className="text-sm font-semibold text-slate-800">Compliance & Auditing</h3>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            The platform is integrated with the Standard Interbank GIRO (IBG) network protocols to execute automated, secure owner payouts twice weekly in compliance with local Bank Negara guidelines.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-2">
            <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block">Remittance Audit Settings</span>
            <div className="flex justify-between">
              <span className="text-slate-500">Gateway Provider:</span>
              <span className="font-semibold text-slate-700">Adyen Smart Pay API</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Next Automatic Cycle:</span>
              <span className="font-semibold text-slate-700">Tuesday, 07:00 AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Compliance Code:</span>
              <span className="font-mono text-slate-600 font-bold">MY-E-PAYMENT-402</span>
            </div>
          </div>

          <button 
            onClick={() => {
              addActivityLog('system', "Exported financial settlement journal: EXCEL_JOURNAL_2026.csv", "Admin");
              alert("Financial audit spreadsheet exported successfully (MOCK Excel Sheet downloaded).");
            }}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Ledger Spreadsheet
          </button>
        </div>
      </div>

      {/* Transaction Auditing Database Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Master Transaction Auditing Log</h3>
            <p className="text-xs text-slate-500">Detailed historical listing of user top-ups, reservation receipts, and commission deductions.</p>
          </div>

          {/* Search/Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search transaction database..." 
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            {/* Filter Toggle */}
            <select 
              value={txFilter}
              onChange={(e: any) => setTxFilter(e.target.value)}
              className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Transacts</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Tx Table */}
        <div className="overflow-x-auto">
          {filteredTx.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No transactions matching filter found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-2">TXN ID</th>
                  <th className="py-2.5 px-2">Driver (User)</th>
                  <th className="py-2.5 px-2">Parking Location / Owner</th>
                  <th className="py-2.5 px-2">Gross Volume</th>
                  <th className="py-2.5 px-2">Platform Cut ({commissionRate}%)</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTx.map((tx) => {
                  const calculatedCommission = Math.round((tx.amount * (commissionRate / 100)) * 100) / 100;
                  
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-2 font-mono text-slate-500 font-bold">{tx.id}</td>
                      <td className="py-3 px-2 font-mono text-slate-600 font-medium">{tx.userEmail}</td>
                      <td className="py-3 px-2">
                        <div className="text-slate-800 font-medium">{tx.location}</div>
                        <div className="text-[10px] text-slate-400">Owner: {tx.ownerName}</div>
                      </td>
                      <td className="py-3 px-2 font-bold text-slate-800">RM {tx.amount.toFixed(2)}</td>
                      <td className="py-3 px-2 text-[#2563EB] font-bold font-mono">RM {calculatedCommission.toFixed(2)}</td>
                      <td className="py-3 px-2">
                        {tx.status === 'completed' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">Completed</span>
                        )}
                        {tx.status === 'refunded' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[10px] font-medium">Refunded</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-400 text-[10px] whitespace-nowrap">{new Date(tx.timestamp).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
