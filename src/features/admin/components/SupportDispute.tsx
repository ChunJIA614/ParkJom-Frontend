import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, HelpCircle, ArrowRight, ShieldCheck, CreditCard, 
  Settings, Check, Send, User, LifeBuoy, CheckCircle2, AlertTriangle, 
  TrendingUp, Play, Trash2, Plus, FileText, CheckSquare, Info
} from 'lucide-react';
import { SupportTicket, Transaction } from '../types';

interface SupportDisputeProps {
  tickets: SupportTicket[];
  setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  addActivityLog: (type: string, message: string, user: string) => void;
  onLowerBollard: (bollardId: string) => void;
}

export default function SupportDispute({ 
  tickets, 
  setTickets,
  transactions,
  setTransactions,
  addActivityLog,
  onLowerBollard
}: SupportDisputeProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(tickets[0]?.id || null);
  const [chatMessage, setChatMessage] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [refundProcessing, setRefundProcessing] = useState(false);

  // Systematic new application creation states
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<'payment' | 'hardware' | 'overstay' | 'other'>('hardware');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newBookingId, setNewBookingId] = useState('');
  
  // Custom declaration checklists for submission
  const [newDecl1, setNewDecl1] = useState(false);
  const [newDecl2, setNewDecl2] = useState(false);
  const [newDecl3, setNewDecl3] = useState(false);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Administrative Review Decision logic (adds custom system review note)
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage || !selectedTicketId) return;

    setTickets(prev => prev.map(t => {
      if (t.id === selectedTicketId) {
        return {
          ...t,
          status: 'pending', // move to pending when admin adds review notes
          chatHistory: [
            ...t.chatHistory,
            { sender: 'admin', message: chatMessage, timestamp: "Just now" }
          ]
        };
      }
      return t;
    }));

    addActivityLog('dispute', `Added compliance assessment note to Form ${selectedTicketId} raised by ${selectedTicket?.userName}`, "Admin Operator");
    setChatMessage('');
    setSuccessToast(`Assessment decision note committed to the immutable ledger.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Create Ticket Form Handler
  const handleCreateTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim() || !newUserName.trim() || !newUserEmail.trim()) {
      return;
    }

    const newTicketId = `TKT-${Math.floor(100 + Math.random() * 900)}`;
    const newTicket: SupportTicket = {
      id: newTicketId,
      bookingId: newBookingId.trim() || undefined,
      userRole: 'owner', // Default as owner since user requested "submitted by owner"
      userName: newUserName,
      email: newUserEmail,
      subject: newSubject,
      category: newCategory,
      description: newDescription,
      status: 'open',
      createdAt: new Date().toISOString(),
      chatHistory: [
        {
          sender: 'user',
          message: `Certified Owner Declarations Logged:\n1. Checked physical hardware state locally [YES]\n2. Assessed occupant/space occupancy locally [YES]\n3. Certified absolute truthfulness of claims [YES]\n\nDetails:\n${newDescription}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setTickets(prev => [newTicket, ...prev]);
    setSelectedTicketId(newTicket.id);
    setIsCreatingTicket(false);
    addActivityLog('dispute', `Systematic dispute form ${newTicketId} officially filed by owner ${newUserName}`, "Owner Portal");
    
    // Clear fields
    setNewSubject('');
    setNewDescription('');
    setNewCategory('hardware');
    setNewUserName('');
    setNewUserEmail('');
    setNewBookingId('');
    setNewDecl1(false);
    setNewDecl2(false);
    setNewDecl3(false);
    
    setSuccessToast(`Dispute Application ${newTicketId} registered and queued for active evaluation.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleResolveTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'resolved' } : t));
    addActivityLog('dispute', `Formally closed dispute application form ${ticketId}`, "Admin Operator");
    setSuccessToast(`Application Form ${ticketId} resolved and archived.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleIssueRefund = (ticket: SupportTicket) => {
    if (!ticket.bookingId) return;
    setRefundProcessing(true);
    addActivityLog('system', `Initiating payment gateway reversal for booking ${ticket.bookingId}`, "Financial Engine");

    setTimeout(() => {
      // Find and refund transaction
      setTransactions(prev => prev.map(tx => tx.bookingId === ticket.bookingId ? { ...tx, status: 'refunded' } : tx));
      setTickets(prev => prev.map(t => t.id === ticket.id ? { 
        ...t, 
        status: 'resolved',
        chatHistory: [
          ...t.chatHistory,
          { sender: 'admin', message: "Administrative Gateway Refund Executed: Full payment reversal has been authorized and dispatched back to the original funding card.", timestamp: "Just now" }
        ]
      } : t));

      setRefundProcessing(false);
      setSuccessToast(`Reversed payment for ${ticket.bookingId}! Form has been resolved.`);
      addActivityLog('system', `Successfully processed Adyen credit refund of RM 9.00 for Booking ${ticket.bookingId}`, "Adyen Gateway");
      setTimeout(() => setSuccessToast(null), 4000);
    }, 1500);
  };

  const handleRemoteOverrideBypass = (ticket: SupportTicket) => {
    const mockBollardId = "BLD-SS15-01";
    onLowerBollard(mockBollardId);
    
    setTickets(prev => prev.map(t => t.id === ticket.id ? {
      ...t,
      chatHistory: [
        ...t.chatHistory,
        { sender: 'admin', message: `Emergency Bypass Commands Dispatched: Sent remote lowering command to smart bollard barrier ${mockBollardId}. Lock override accepted by hardware.`, timestamp: "Just now" }
      ]
    } : t));

    setSuccessToast(`Bypass Command Sent! Bollard ${mockBollardId} lowered manually.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  return (
    <div id="support-dispute" className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 id="support-title" className="text-2xl font-bold text-slate-800 tracking-tight">Support & Dispute Resolution</h2>
          <p className="text-slate-500 text-sm">Review formal owner support declarations, run diagnostics on hardware claims, and authorize refunds on systematic application files.</p>
        </div>
      </div>

      {/* Success Toast */}
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

      {/* Split Window */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh]">
        
        {/* Left: Tickets Queue List (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disputes Register</h3>
              <span className="text-[10px] bg-[#2563EB]/5 text-[#2563EB] font-bold px-2 py-0.5 rounded border border-[#2563EB]/10">Systematic Forms</span>
            </div>

            {/* Tickets list */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {tickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      setIsCreatingTicket(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected && !isCreatingTicket 
                        ? 'bg-[#2563EB]/5 border-[#2563EB]/20 shadow-xs' 
                        : 'bg-slate-50/30 border-slate-100 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{t.id}</span>
                      
                      {t.status === 'open' && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">Under Review</span>
                      )}
                      {t.status === 'pending' && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider">Awaiting Action</span>
                      )}
                      {t.status === 'resolved' && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider">Resolved</span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1 mt-1">{t.subject}</h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                    
                    <div className="flex justify-between items-center text-[9px] text-slate-400 mt-2 pt-2 border-t border-slate-100/60">
                      <span>Owner: {t.userName}</span>
                      <span className="uppercase font-semibold text-[#2563EB]">{t.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* New Dispute Trigger */}
            <button
              onClick={() => {
                setSelectedTicketId(null);
                setIsCreatingTicket(true);
              }}
              className={`mt-3 w-full py-2.5 border border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-lg ${
                isCreatingTicket 
                  ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]' 
                  : 'border-[#2563EB]/30 hover:border-[#2563EB] text-[#2563EB] bg-[#2563EB]/5 hover:bg-[#2563EB]/10'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Submit New Dispute Form
            </button>
          </div>
        </div>

        {/* Center/Right: Selected Ticket Form details OR New Form submission */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          
          {isCreatingTicket ? (
            /* ==========================================================
               MODE: CREATE NEW SYSTEMATIC DISPUTE APPLICATION FORM (OWNER)
               ========================================================== */
            <>
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between h-full overflow-hidden">
                <div className="flex flex-col h-full justify-between overflow-hidden">
                  
                  {/* Header */}
                  <div className="border-b border-slate-100 pb-3 flex items-start gap-2.5">
                    <FileText className="w-5 h-5 text-[#2563EB]" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Formal Dispute Submission Form</h3>
                      <p className="text-[10px] text-slate-400">Section 1 to 4 must be completely certified by the registered space host.</p>
                    </div>
                  </div>

                  {/* Form fields container */}
                  <form onSubmit={handleCreateTicketSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs text-slate-700">
                    
                    {/* Part A: Owner Profiles */}
                    <div className="space-y-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Part A: Owner Profile</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Host Full Name *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="e.g. Tan Kah Seng"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Registered Host Email *</label>
                          <input 
                            required
                            type="email" 
                            placeholder="e.g. tan.ks@gmail.com"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Part B: References */}
                    <div className="space-y-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Part B: Resource References</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Impacted Booking ID Reference</label>
                          <input 
                            type="text" 
                            placeholder="e.g. BKG-2026-1024"
                            value={newBookingId}
                            onChange={(e) => setNewBookingId(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Dispute Category *</label>
                          <select 
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as any)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                          >
                            <option value="hardware">Hardware / Bluetooth Bollard Malfunction</option>
                            <option value="payment">Billing / Refund / Double Charging</option>
                            <option value="overstay">Occupant Encroachment / Overstay Penalty</option>
                            <option value="other">General Operational Conflict</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Part C: Declarations & Subject */}
                    <div className="space-y-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Part C: Incident Declaration</span>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Incident Subject / Headline Title *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="e.g. Subang SS15 Bay 12 Bluetooth Synced command failed"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Factual Narrative & Physical Evidence Statement *</label>
                          <textarea 
                            required
                            rows={3}
                            placeholder="Provide a precise systematic sequence of what occurred, including local physical observations on site..."
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden resize-none leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Part D: Physical Verification Declarations */}
                    <div className="space-y-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block text-rose-600">Part D: Systematic Factual Certification</span>
                      <div className="space-y-2.5 text-[11px] text-slate-600">
                        <label className="flex items-start gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={newDecl1}
                            onChange={(e) => setNewDecl1(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span>I have personally checked the physical device/bay status on-site.</span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={newDecl2}
                            onChange={(e) => setNewDecl2(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span>I verify that the tenant or driver has attempted to park or vacate.</span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={newDecl3}
                            onChange={(e) => setNewDecl3(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span>I certify under penalty of account suspension that all logged details are factual.</span>
                        </label>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      disabled={!newSubject.trim() || !newDescription.trim() || !newUserName.trim() || !newUserEmail.trim() || !newDecl1 || !newDecl2 || !newDecl3}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckSquare className="w-4 h-4" /> Certify & Submit Application Form
                    </button>
                  </form>
                </div>
              </div>

              {/* Guide sidebar on Right */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm h-full flex flex-col justify-between overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Info className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Owner Policy Guide</h3>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Disputes filed by owners are mapped against physical hardware telemetry and gateway logs to guarantee database synchronization.
                  </p>

                  <div className="space-y-3.5 pt-2">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700">1. Verification Check</h4>
                      <p className="text-[10px] text-slate-500">Every dispute must be physically inspected on site prior to submitting claims.</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700">2. Immutability Principle</h4>
                      <p className="text-[10px] text-slate-500">All submitted applications are written to our secure administrative audit database log and cannot be altered.</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700">3. Support Processing Time</h4>
                      <p className="text-[10px] text-slate-500">System reviews are resolved within 24 hours of submission. Corrective payments are automatically triggered via Adyen.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsCreatingTicket(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel & Return
                </button>
              </div>
            </>
          ) : (
            /* ==========================================================
               MODE: VIEW SYSTEMATIC DISPUTE / SUPPORT APPLICATION FORM DETAILS
               ========================================================== */
            <>
              {/* Main Systematic Form Viewer (takes 2 of the 3 cols) */}
              <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between h-full overflow-hidden">
                {selectedTicket ? (
                  <div className="flex flex-col h-full justify-between overflow-hidden">
                    {/* Header: Official Document style */}
                    <div className="border-b border-slate-100 pb-2.5 flex items-start justify-between">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase tracking-wider">OFFICIAL RECONCILIATION FILE</span>
                        <h3 className="text-sm font-bold text-slate-800">{selectedTicket.subject}</h3>
                      </div>
                      <span className="text-[10px] bg-[#2563EB]/5 text-[#2563EB] font-mono border border-[#2563EB]/15 px-2 py-0.5 rounded uppercase font-semibold">{selectedTicket.category}</span>
                    </div>

                    {/* Systematic Form content */}
                    <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                      
                      {/* SECTION 1: APPLICANT METADATA */}
                      <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs">
                        <span className="font-bold text-[9px] text-[#2563EB] uppercase tracking-wider block mb-2">Section 1: Applicant Profile Mapping</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Registered Name</span>
                            <span className="font-semibold text-slate-800">{selectedTicket.userName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Role Classification</span>
                            <span className="font-semibold text-slate-800 capitalize">{selectedTicket.userRole} Operator</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Email Address</span>
                            <span className="font-mono text-slate-600">{selectedTicket.email}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Submission Timestamp</span>
                            <span className="text-slate-600 font-semibold">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: PHYSICAL SYSTEM REF */}
                      <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs">
                        <span className="font-bold text-[9px] text-[#2563EB] uppercase tracking-wider block mb-2">Section 2: Associated Resources</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Linked Booking Reference</span>
                            <span className="font-mono text-slate-700 font-bold">{selectedTicket.bookingId || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Assigned hardware node</span>
                            <span className="font-mono text-slate-700 font-bold">BLD-SS15-01 (SS15 Bay 12)</span>
                          </div>
                        </div>
                      </div>

                      {/* SECTION 3: SYSTEMATIC FAILED BEHAVIOR STATEMENT */}
                      <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs">
                        <span className="font-bold text-[9px] text-[#2563EB] uppercase tracking-wider block mb-1">Section 3: Incident Narrative Statement</span>
                        <p className="text-slate-700 leading-relaxed font-sans">{selectedTicket.description}</p>
                      </div>

                      {/* SECTION 4: IMMUTABLE HISTORICAL ASSESSMENT LEDGER */}
                      <div className="space-y-3">
                        <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider block">Section 4: Compliance Assessment Timeline</span>
                        
                        <div className="relative pl-4 border-l border-slate-100 space-y-3.5 ml-1">
                          
                          {/* Seed event - Original Form upload */}
                          <div className="relative">
                            <span className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-slate-400" />
                            <div className="text-[11px] space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-semibold text-slate-700">Owner Dispute Form Uploaded</span>
                                <span className="text-slate-400 font-mono">Original Entry</span>
                              </div>
                              <p className="text-slate-500">System verified digital ID match and logged formal dispute.</p>
                            </div>
                          </div>

                          {/* Historical assessment updates */}
                          {selectedTicket.chatHistory.map((chat, idx) => {
                            const isAdmin = chat.sender === 'admin';
                            
                            return (
                              <div key={idx} className="relative">
                                <span className={`absolute -left-[20px] top-1.5 w-2 h-2 rounded-full ${isAdmin ? 'bg-[#2563EB]' : 'bg-slate-600'}`} />
                                <div className="text-[11px] space-y-1">
                                  <div className="flex justify-between text-[10px]">
                                    <span className={`font-semibold ${isAdmin ? 'text-[#2563EB]' : 'text-slate-700'}`}>
                                      {isAdmin ? 'Administrative Decision Note' : `Owner Testimony Update`}
                                    </span>
                                    <span className="text-slate-400 font-mono">{chat.timestamp}</span>
                                  </div>
                                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/80 text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {chat.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* SECTION 5: ADMINISTRATIVE ACTIONS INJECTOR */}
                    {selectedTicket.status !== 'resolved' ? (
                      <form onSubmit={handleSendMessage} className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Commit Administrative Assessment Note</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add compliance assessment notes, physical inspection details, or instructions..." 
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
                          />
                          <button 
                            type="submit"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" /> Commit Note
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="border-t border-slate-100 pt-3 text-center text-xs text-emerald-600 font-semibold bg-emerald-50/50 py-2.5 rounded-lg">
                        This formal application is complete and marked as [RESOLVED / ARCHIVED].
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-1">
                    <LifeBuoy className="w-8 h-8 text-slate-300" />
                    <p>Select an active application file from the queue to start evaluation.</p>
                  </div>
                )}
              </div>

              {/* Right: Quick Action Controls (takes 1 col) */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between h-full overflow-hidden">
                {selectedTicket ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Administrative Bypass</h3>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Authorize real-time physical bypasses or execute gateway refunds to reconcile differences in this file.
                      </p>

                      {/* Operational buttons */}
                      <div className="space-y-2">
                        {/* Remote Override Trigger */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">IoT Lock Override</span>
                          <button 
                            onClick={() => handleRemoteOverrideBypass(selectedTicket)}
                            disabled={selectedTicket.status === 'resolved'}
                            className="w-full py-2.5 bg-[#2563EB]/5 hover:bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold rounded-lg border border-[#2563EB]/10 text-left px-3 flex items-center justify-between disabled:opacity-50 cursor-pointer"
                          >
                            <span>Lower Bollard SS15-01</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Refund trigger */}
                        {selectedTicket.bookingId && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Financial Gateway Reversal</span>
                            <button 
                              onClick={() => handleIssueRefund(selectedTicket)}
                              disabled={refundProcessing || selectedTicket.status === 'resolved'}
                              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-100/60 text-left px-3 flex items-center justify-between disabled:opacity-50 cursor-pointer"
                            >
                              {refundProcessing ? (
                                <span>Refunding...</span>
                              ) : (
                                <>
                                  <span>Process Full Refund</span>
                                  <CreditCard className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resolve button at bottom */}
                    {selectedTicket.status !== 'resolved' && (
                      <button 
                        onClick={() => handleResolveTicket(selectedTicket.id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Close Application (Resolve)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs italic">
                    Awaiting application selection.
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
}
