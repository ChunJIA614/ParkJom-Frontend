import React, { useState } from 'react';
import { 
  Radio, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  User, 
  Mail, 
  FileText, 
  Settings, 
  ShieldAlert, 
  Undo, 
  Send, 
  Plus, 
  Check, 
  HelpCircle, 
  Info, 
  Layers,
  Sparkles
} from 'lucide-react';

interface TimelineEvent {
  label: string;
  time: string;
  note: string;
  type: 'system' | 'user' | 'admin';
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'UNDER REVIEW' | 'AWAITING ACTION' | 'RESOLVED';
  category: 'HARDWARE' | 'PAYMENT' | 'SYSTEM' | 'ACCOUNT';
  applicantName: string;
  role: string;
  email: string;
  timestamp: string;
  bookingRef: string;
  hardwareNode: string;
  timeline: TimelineEvent[];
}

export default function SupportTickets() {
  const [activeTab, setActiveTab] = useState<'admin' | 'submit'>('admin');
  
  // Seed initial tickets based on the user's uploaded image
  const [tickets, setTickets] = useState<SupportTicket[]>([
    {
      id: 'TKT-101',
      subject: 'Bollard not lowering (SS15 Bay 12)',
      description: 'The incoming driver is trying to park but the bollard stays raised despite a valid active reservation. The ESP32 is flashing a yellow led and is not receiving the lower command.',
      status: 'UNDER REVIEW',
      category: 'HARDWARE',
      applicantName: 'Tan Kah Seng',
      role: 'Property Owner',
      email: 'kansen.t@gmail.com',
      timestamp: '05/07/2026, 14:30:22',
      bookingRef: 'BKG-2026-1182',
      hardwareNode: 'BLD-SS15-01 (SS15 Bay 12)',
      timeline: [
        { 
          label: 'Owner Dispute Form Uploaded', 
          time: 'Original Entry', 
          note: 'System verified digital ID match and logged formal hardware dispute.', 
          type: 'system' 
        },
        { 
          label: 'Owner Testimony Update', 
          time: '02:35 PM', 
          note: "The gate won't open, driver is waiting. I tried sending the LOWER override command through the Home Dashboard but got a remote handshake timeout.", 
          type: 'user' 
        },
        { 
          label: 'Automated Diagnostic Log', 
          time: '02:40 PM', 
          note: 'Gateway BLD-SS15-01 ping successful, but actuator motor current spike detected. Suggests temporary physical jam or mechanical resistance.', 
          type: 'system' 
        }
      ]
    },
    {
      id: 'TKT-102',
      subject: 'Accidental booking of wrong bay',
      description: 'I booked Main Place Residence Bay P4-99 by mistake, but I actually parked at Bay P4-98. The tenant at P4-99 filed an overstay but I was already gone. Requesting refund adjustment.',
      status: 'AWAITING ACTION',
      category: 'PAYMENT',
      applicantName: 'Bobby Jones',
      role: 'Driver Operator',
      email: 'bobby.jones@yahoo.com',
      timestamp: '04/07/2026, 09:12:00',
      bookingRef: 'BKG-2026-0851',
      hardwareNode: 'BLD-MP-44 (Main Place Bay P4-99)',
      timeline: [
        { 
          label: 'Owner Dispute Form Uploaded', 
          time: 'Original Entry', 
          note: 'System logged payment dispute. Awaiting administrative review of transaction logs.', 
          type: 'system' 
        },
        { 
          label: 'Owner Testimony Update', 
          time: '09:15 AM', 
          note: 'I can attach the credit card statement if needed. Please adjust the payout to the correct owner account.', 
          type: 'user' 
        }
      ]
    },
    {
      id: 'TKT-103',
      subject: 'Double charged on wallet top-up',
      description: 'My wallet top-up failed first, then I completed it again. However, my bank statement shows two deductions of RM50.00. Please refund the duplicate transaction.',
      status: 'RESOLVED',
      category: 'PAYMENT',
      applicantName: 'Farhan Daniel',
      role: 'Driver Operator',
      email: 'farhan.d@gmail.com',
      timestamp: '03/07/2026, 19:45:00',
      bookingRef: 'BKG-2026-0994',
      hardwareNode: 'BLD-SS15-01 (SS15 Bay 12)',
      timeline: [
        { 
          label: 'Owner Dispute Form Uploaded', 
          time: 'Original Entry', 
          note: 'System verified digital ID match and logged formal dispute.', 
          type: 'system' 
        },
        { 
          label: 'Owner Testimony Update', 
          time: '11:45 AM', 
          note: 'I top up my wallet with credit card and it got charged twice. Only RM50 reflects in my balance.', 
          type: 'user' 
        },
        { 
          label: 'Administrative Decision Note', 
          time: '02:15 PM', 
          note: 'We have audited the payment gateway logs and identified a gateway sync latency issue. The duplicate charge has been voided.', 
          type: 'admin' 
        },
        { 
          label: 'Owner Testimony Update', 
          time: '03:00 PM', 
          note: 'Thank you for the quick resolution. Verified refund in bank.', 
          type: 'user' 
        }
      ]
    }
  ]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>('TKT-103');
  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || tickets[0];

  // Submit form states
  const [formSubject, setFormSubject] = useState('');
  const [formCategory, setFormCategory] = useState<'HARDWARE' | 'PAYMENT' | 'SYSTEM' | 'ACCOUNT'>('HARDWARE');
  const [formHardwareNode, setFormHardwareNode] = useState('BLD-SS15-01 (SS15 Bay 12)');
  const [formBookingRef, setFormBookingRef] = useState('BKG-2026-1201');
  const [formDescription, setFormDescription] = useState('');
  const [formApplicantName, setFormApplicantName] = useState('Chaw Chun Jia');
  const [formEmail, setFormEmail] = useState('chunjia.owner@gmail.com');
  
  // Custom action states for interactive demo
  const [customReplyText, setCustomReplyText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject.trim() || !formDescription.trim()) {
      triggerToast('Please fill out all required fields.', 'warning');
      return;
    }

    const nextIdNum = Math.max(...tickets.map(t => parseInt(t.id.split('-')[1]))) + 1;
    const nextId = `TKT-${nextIdNum}`;
    
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const newTicket: SupportTicket = {
      id: nextId,
      subject: formSubject,
      category: formCategory,
      hardwareNode: formHardwareNode,
      bookingRef: formBookingRef || 'N/A',
      description: formDescription,
      applicantName: formApplicantName,
      role: 'Property Owner',
      email: formEmail,
      status: 'AWAITING ACTION',
      timestamp: formattedDate,
      timeline: [
        {
          label: 'Owner Dispute Form Uploaded',
          time: 'Original Entry',
          note: `System registered ticket ${nextId}. Form uploaded successfully with digital signature.`,
          type: 'system'
        },
        {
          label: 'Incident Narrative Statement Added',
          time: 'Original Entry',
          note: formDescription,
          type: 'user'
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setSelectedTicketId(nextId);
    
    // Reset Form
    setFormSubject('');
    setFormDescription('');
    
    triggerToast(`Ticket ${nextId} submitted successfully to Administration!`, 'success');
    setActiveTab('admin'); // Switch to the review dashboard instantly to let them see it!
  };

  const handleAddReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReplyText.trim()) return;

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTickets(prev => prev.map(t => {
      if (t.id === selectedTicketId) {
        return {
          ...t,
          timeline: [
            ...t.timeline,
            {
              label: 'Owner Testimony Update',
              time: formattedTime,
              note: customReplyText,
              type: 'user'
            }
          ]
        };
      }
      return t;
    }));

    setCustomReplyText('');
    triggerToast('Reply message added to compliance timeline!', 'success');
  };

  // Administrative Bypass Actions (Simulating Admin Side)
  const executeBypassLower = (deviceId: string) => {
    triggerToast(`Sending remote unlock/lower signal to gateway ${deviceId}...`, 'info');
    
    setTimeout(() => {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            status: 'RESOLVED',
            timeline: [
              ...t.timeline,
              {
                label: 'Administrative Decision Note',
                time: formattedTime,
                note: `Administrative bypass executed. Issued forced LOWER signal to physical actuator ${deviceId}. Handshake verified.`,
                type: 'admin'
              }
            ]
          };
        }
        return t;
      }));

      triggerToast(`Bollard ${deviceId} forced lower override completed successfully!`, 'success');
    }, 1500);
  };

  const executeBypassRefund = () => {
    triggerToast('Contacting payment gateway API to reverse charge...', 'info');

    setTimeout(() => {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            status: 'RESOLVED',
            timeline: [
              ...t.timeline,
              {
                label: 'Administrative Decision Note',
                time: formattedTime,
                note: `Financial reversal processed. Double charge refunded back to linked account via Stripe Gateway. Booking ref: ${t.bookingRef}`,
                type: 'admin'
              }
            ]
          };
        }
        return t;
      }));

      triggerToast('RM 50.00 dispute resolved. Funds reversed successfully!', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Systematic Compliance Hub
          </span>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Support Tickets & Disputes</h1>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">
            Submit formal application forms to request remote hardware overrides, report broken physical smart bollards, or resolve payment/escrow disputes with administrators.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-center shrink-0">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === 'admin' 
                ? 'bg-white text-blue-600 shadow' 
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }
            `}
          >
            <Layers className="w-3.5 h-3.5" />
            Disputes Register (Admin Portal)
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer
              ${activeTab === 'submit' 
                ? 'bg-white text-blue-600 shadow' 
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }
            `}
          >
            <Plus className="w-3.5 h-3.5" />
            Submit New Ticket
          </button>
        </div>
      </div>

      {activeTab === 'admin' ? (
        /* Disputes Register View - Matches the User Screenshot layout exactly */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Disputes Register List (3/12 span) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Disputes Register</h3>
                <button 
                  onClick={() => setActiveTab('submit')}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 font-bold text-[10px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  Systematic Forms
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {tickets.map((ticket) => {
                  const isActive = ticket.id === selectedTicketId;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full text-left p-4 transition-all hover:bg-slate-50 flex flex-col gap-2 cursor-pointer border-l-4
                        ${isActive 
                          ? 'bg-blue-50/20 border-blue-600' 
                          : 'border-transparent'
                        }
                      `}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">{ticket.id}</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase
                          ${ticket.status === 'UNDER REVIEW' ? 'bg-rose-50 text-rose-600' : ''}
                          ${ticket.status === 'AWAITING ACTION' ? 'bg-amber-50 text-amber-600' : ''}
                          ${ticket.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : ''}
                        `}>
                          {ticket.status}
                        </span>
                      </div>

                      <div className="font-bold text-xs text-slate-800 line-clamp-1 leading-tight">
                        {ticket.subject}
                      </div>

                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                        {ticket.description}
                      </p>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[9px] text-slate-400 font-medium">Owner: {ticket.applicantName}</span>
                        <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100/30 px-1.5 py-0.5 rounded tracking-wider uppercase">
                          {ticket.category}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Tip card */}
            <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex gap-3 text-xs text-slate-600">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Administrator Emulator</span>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  This portal replicates the admin panel layout. Select a ticket and use the <strong>Administrative Bypass</strong> controls on the right to resolve issues in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Middle Column: Official Reconciliation Detail (6/12 span) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            
            {/* Detail Title Header */}
            <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">OFFICIAL RECONCILIATION FILE</span>
                <h2 className="text-base font-black text-slate-900 mt-0.5 leading-snug">{selectedTicket.subject}</h2>
              </div>
              <span className="bg-blue-600 text-white font-mono text-[9px] font-black px-3 py-1 rounded tracking-widest uppercase shadow-sm">
                {selectedTicket.category}
              </span>
            </div>

            {/* SECTION 1: APPLICANT PROFILE MAPPING */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">SECTION 1: APPLICANT PROFILE MAPPING</h4>
              <div className="grid grid-cols-2 gap-4 bg-slate-50/60 border border-slate-100 rounded-xl p-4">
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Registered Name</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedTicket.applicantName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Role Classification</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedTicket.role}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-medium">Email Address</span>
                  <span className="font-semibold text-slate-600 text-xs mt-0.5 block">{selectedTicket.email}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-medium">Submission Timestamp</span>
                  <span className="font-mono font-bold text-slate-700 text-[11px] mt-0.5 block">{selectedTicket.timestamp}</span>
                </div>
              </div>
            </div>

            {/* SECTION 2: ASSOCIATED RESOURCES */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">SECTION 2: ASSOCIATED RESOURCES</h4>
              <div className="grid grid-cols-2 gap-4 bg-slate-50/60 border border-slate-100 rounded-xl p-4">
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Linked Booking Reference</span>
                  <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">{selectedTicket.bookingRef}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Assigned hardware node</span>
                  <span className="font-semibold text-slate-600 text-xs mt-0.5 block">{selectedTicket.hardwareNode}</span>
                </div>
              </div>
            </div>

            {/* SECTION 3: INCIDENT NARRATIVE STATEMENT */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">SECTION 3: INCIDENT NARRATIVE STATEMENT</h4>
              <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed font-medium">
                {selectedTicket.description}
              </div>
            </div>

            {/* SECTION 4: COMPLIANCE ASSESSMENT TIMELINE */}
            <div className="space-y-4 pt-2">
              <h4 className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">SECTION 4: COMPLIANCE ASSESSMENT TIMELINE</h4>
              
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {selectedTicket.timeline.map((step, idx) => {
                  const isLast = idx === selectedTicket.timeline.length - 1;
                  return (
                    <div key={idx} className="relative">
                      {/* Timeline Dot Indicator */}
                      <span className={`absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full border bg-white flex items-center justify-center
                        ${step.type === 'system' ? 'border-blue-400 text-blue-500' : ''}
                        ${step.type === 'user' ? 'border-amber-400 text-amber-500' : ''}
                        ${step.type === 'admin' ? 'border-emerald-500 text-emerald-500' : ''}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full 
                          ${step.type === 'system' ? 'bg-blue-400' : ''}
                          ${step.type === 'user' ? 'bg-amber-400' : ''}
                          ${step.type === 'admin' ? 'bg-emerald-500' : ''}
                        `}></span>
                      </span>

                      {/* Header row */}
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="font-bold text-slate-800 text-xs">{step.label}</span>
                        <span className="text-[10px] font-mono text-slate-400">{step.time}</span>
                      </div>

                      {/* Message Content */}
                      <div className="mt-1.5">
                        {step.type === 'user' ? (
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">
                            {step.note}
                          </div>
                        ) : step.type === 'admin' ? (
                          <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl text-xs text-slate-700 leading-relaxed font-semibold">
                            {step.note}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {step.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick response text-box for user to add information */}
              <form onSubmit={handleAddReply} className="pt-2 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Provide additional testimony or update on the issue..."
                  value={customReplyText}
                  onChange={(e) => setCustomReplyText(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors flex items-center gap-1 cursor-pointer text-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  Update
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Administrative Bypass Controls (3/12 span) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-4 h-4 text-slate-500" />
              <h3 className="font-black text-slate-950 text-xs uppercase tracking-wider">Administrative Bypass</h3>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400 mt-1">
              Authorize real-time physical bypasses or execute gateway refunds to reconcile differences in this file.
            </p>

            {/* IOT LOCK OVERRIDE MODULE */}
            <div className="space-y-3 pt-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">IOT LOCK OVERRIDE</span>
              
              <button
                onClick={() => executeBypassLower('BLD-SS15-01')}
                disabled={selectedTicket.status === 'RESOLVED' && selectedTicket.category === 'HARDWARE'}
                className="w-full flex items-center justify-between p-3.5 bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100/70 rounded-xl text-xs font-bold text-blue-700 transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <span>Lower Bollard SS15-01</span>
                <ArrowRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* FINANCIAL GATEWAY REVERSAL MODULE */}
            <div className="space-y-3 pt-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">FINANCIAL GATEWAY REVERSAL</span>
              
              <button
                onClick={executeBypassRefund}
                disabled={selectedTicket.status === 'RESOLVED'}
                className="w-full flex items-center justify-between p-3.5 bg-rose-50/50 hover:bg-rose-100/70 border border-rose-100/70 rounded-xl text-xs font-bold text-rose-700 transition-colors cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <span>Process Full Refund</span>
                <Undo className="w-4 h-4 text-rose-500 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Security Certification Signpost */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex gap-3 text-[10px] leading-relaxed text-slate-500">
              <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 font-bold">Admin Authority Audit</strong>
                <p className="mt-0.5 text-slate-500">
                  All administrative overrides are cryptographically signed, timestamped, and audited against corresponding smart contract registers automatically.
                </p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Submit Ticket Application Form View */
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Banner */}
          <div className="bg-[#0f172a] text-white p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <span className="bg-blue-500 text-white font-mono text-[9px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider">
                COMPLIANCE DOCUMENT FORM
              </span>
              <h2 className="text-lg font-black tracking-tight mt-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Systematic Administrative Action Application
              </h2>
              <p className="text-slate-300 text-xs mt-1">
                Establish an official dispute registry item. This documentation is logged onto the compliance board for instantaneous administrative review.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateTicket} className="p-6 space-y-6">
            
            {/* Applicant Metadata (Pre-filled for user convenience but editable) */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Pre-Authorized Applicant Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registered Name</label>
                  <input
                    type="text"
                    value={formApplicantName}
                    onChange={(e) => setFormApplicantName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Registered Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-semibold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Ticket General Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Issue Classification Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  required
                >
                  <option value="HARDWARE">HARDWARE (Smart Lock, Barrier Jammed, Faulty Sensors)</option>
                  <option value="PAYMENT">PAYMENT (Refund, Overcharge, Wallet Top-up Issue)</option>
                  <option value="SYSTEM">SYSTEM (Software glitch, mobile connection error)</option>
                  <option value="ACCOUNT">ACCOUNT (KYC verification, login issues)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Linked Hardware Node</label>
                <select
                  value={formHardwareNode}
                  onChange={(e) => setFormHardwareNode(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                  required
                >
                  <option value="BLD-SS15-01 (SS15 Bay 12)">BLD-SS15-01 (SS15 Bay 12)</option>
                  <option value="BLD-SS15-02 (SS15 Bay 13)">BLD-SS15-02 (SS15 Bay 13)</option>
                  <option value="BLD-KLCC-09 (KLCC Bay B2-44)">BLD-KLCC-09 (KLCC Bay B2-44)</option>
                  <option value="BLD-MP-44 (Main Place Bay P4-99)">BLD-MP-44 (Main Place Bay P4-99)</option>
                  <option value="N/A - General Account Issue">N/A - General Account Issue</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Linked Booking Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. BKG-2026-1201"
                  value={formBookingRef}
                  onChange={(e) => setFormBookingRef(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ticket Summary Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Ultrasonic sensor fails to detect car parking"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-semibold"
                  required
                />
              </div>
            </div>

            {/* Narrative Area */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Detailed Incident Narrative Statement</label>
              <textarea
                rows={4}
                placeholder="Describe the issue you experienced. Please specify exactly what happened, driver plates if relevant, and error blinking lights observed on the ESP32 hardware device..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 leading-relaxed font-medium"
                required
              ></textarea>
            </div>

            {/* Legal Statement */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex gap-3 text-[10px] leading-relaxed text-slate-500">
              <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 font-bold">Applicant Legal Affirmation</strong>
                <p className="mt-0.5 text-slate-500">
                  By submitting this action form, you affirm that the details recorded herein are factual representations of the physical site conditions. Misrepresentation is subject to platform escrow holdbacks.
                </p>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Submit Application Form
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Toast Alert Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div className={`px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-semibold max-w-sm backdrop-blur bg-white/95
            ${toast.type === 'success' ? 'border-emerald-100 text-emerald-900 shadow-emerald-100/50' : ''}
            ${toast.type === 'info' ? 'border-blue-100 text-blue-900 shadow-blue-100/50' : ''}
            ${toast.type === 'warning' ? 'border-amber-100 text-amber-900 shadow-amber-100/50' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toast.type === 'info' && <Radio className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
