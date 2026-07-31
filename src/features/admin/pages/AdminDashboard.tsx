import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, ShieldCheck, Radio, AlertOctagon, 
  Landmark, LifeBuoy, Menu, X, LogOut,
  ShieldAlert, Lock
} from 'lucide-react';
import DashboardHeader from '@/shared/components/DashboardHeader';
import BottomNav from '@/shared/ui/BottomNav';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';

import { 
  initialStats
} from '../data/mockData';
import { IoTBollard, ListingRequest, OwnerPayout, Transaction, OverstayRecord, SupportTicket } from '../types';

import DashboardHome from '../components/DashboardHome';
import ListingGovernance from '../components/ListingGovernance';
import IotHealthMonitor from '../components/IotHealthMonitor';
import FinanceSettlement from '../components/FinanceSettlement';
import OverstayEnforcement from '../components/OverstayEnforcement';
import SupportDispute from '../components/SupportDispute';
import SystemAudit from '../components/SystemAudit';
import SystemConfiguration from '../components/SystemConfiguration';

const API_BASE = import.meta.env.VITE_API_BASE ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://parkjom-api-gbgcbycbcjghczgu.malaysiawest-01.azurewebsites.net/api'
    : '/api');

type ActiveView = 'home' | 'governance' | 'iot' | 'settlement' | 'enforcement' | 'support' | 'audit' | 'system';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const token = user?.token ?? '';
  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // App core states — all data fetched from backend
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const saved = localStorage.getItem('parkjom_admin_view');
    return (saved as ActiveView) || 'home';
  });

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem('parkjom_admin_view', activeView);
  }, [activeView]);
  const [stats, setStats] = useState(initialStats);
  const [bollards, setBollards] = useState<IoTBollard[]>([]);
  const [listings, setListings] = useState<ListingRequest[]>([]);
  const [payouts, setPayouts] = useState<OwnerPayout[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overstays, setOverstays] = useState<OverstayRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activityLogs, setActivityLogs] = useState<{ id: string; type: string; message: string; timestamp: string; user: string }[]>([]);

  // Global system configs (live-wired into widgets)
  const [systemConfig, setSystemConfig] = useState({
    commissionRate: 15,
    gracePeriodMinutes: 15
  });

  // Action logging helper
  const addActivityLog = (type: string, message: string, user: string) => {
    const newLog = {
      id: `LOG-${Date.now()}`,
      type,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      user
    };
    setActivityLogs(prev => [newLog, ...prev]);

    // Recalculate metrics on state changes
    setStats(prev => ({
      ...prev,
      onlineBollardsRate: Math.round((bollards.filter(b => b.status === 'online').length / bollards.length) * 1000) / 10,
      pendingListingsCount: listings.filter(l => l.status === 'pending').length,
      openDisputesCount: tickets.filter(t => t.status !== 'resolved').length,
      activeOverstaysCount: overstays.filter(o => o.status !== 'resolved').length
    }));
  };

  // ---- Fetch verification requests from backend (pending + moderated) ----
  const fetchListings = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/parking/verification-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      const data: any[] = body.data ?? (Array.isArray(body) ? body : []);

      const statusMap: Record<string, ListingRequest['status']> = {
        pending: 'pending',
        approved: 'approved',
        rejected: 'rejected',
      };

      // Map VerificationRequestDTO → ListingRequest for the admin UI
      const mapped: ListingRequest[] = data.map((v: any) => ({
        id: v.verificationRequestId.toString(),
        verificationRequestId: v.verificationRequestId,
        parkingSpotId: v.parkingSpotId,
        propertyId: v.propertyId,
        ownerName: v.submittedByName ?? 'Unknown',
        ownerEmail: v.submittedByEmail ?? '-',
        location: v.propertyName ?? `Property #${v.propertyId}`,
        bayNumber: v.parkingLabel ?? `Spot #${v.parkingSpotId}`,
        hourlyRate: v.hourlyRate ?? 0,
        documents: { titleDeed: '-', utilityBill: '-', identityCard: '-' },
        submittedAt: v.submittedAt,
        status: statusMap[(v.verificationStatus ?? '').toLowerCase()] ?? 'pending',
      }));
      setListings(mapped);
      setStats(prev => ({ ...prev, pendingListingsCount: mapped.filter(l => l.status === 'pending').length }));
    } catch { /* API not available yet */ }
  }, [token]);

  // Fetch on mount + when token becomes available
  useEffect(() => {
    if (token) fetchListings();
  }, [fetchListings]);

  // Refresh every time the Listing Governance page is opened
  useEffect(() => {
    if (activeView === 'governance') {
      fetchListings();
    }
  }, [activeView, fetchListings]);

  // ---- Admin actions ----

  const handleApproveListing = async (id: string) => {
    try {
      const listing = listings.find(l => l.id === id);
      if (!listing) return;

      const res = await fetch(`${API_BASE}/parking/verification-requests/${listing.verificationRequestId}/approve`, {
        method: 'POST',
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          isApproved: true,
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success !== false) {
        await fetchListings();
        addActivityLog('governance',
          data?.message || `Approved verification request #${listing.verificationRequestId} → parking spot #${data?.parkingSpotId ?? listing.parkingSpotId}`,
          "Admin");
      } else {
        addActivityLog('governance', `Failed to approve listing ID: ${id} — ${data?.message || 'API error'}`, "Admin");
      }
    } catch (err: any) {
      addActivityLog('governance', `Network error approving listing ID: ${id}`, "Admin");
    }
  };

  const handleRejectListing = async (id: string, reason: string) => {
    try {
      const listing = listings.find(l => l.id === id);
      if (!listing) return;

      const res = await fetch(`${API_BASE}/parking/verification-requests/${listing.verificationRequestId}/reject`, {
        method: 'POST',
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success !== false) {
        await fetchListings();
        addActivityLog('governance',
          data?.message || `Rejected verification request #${listing.verificationRequestId} — reason: ${reason}`,
          "Admin");
      } else {
        addActivityLog('governance', `Failed to reject listing ID: ${id} — ${data?.message || 'API error'}`, "Admin");
      }
    } catch (err: any) {
      addActivityLog('governance', `Network error rejecting listing ID: ${id}`, "Admin");
    }
  };

  // Trigger from support component to lower a bollard
  const handleLowerBollard = (bollardId: string) => {
    setBollards(prev => prev.map(b => b.id === bollardId ? { ...b, barrierState: 'lowered' } : b));
    addActivityLog('bollard_state', `Emergency Override: Lowered barrier of ${bollardId} from Support Ticket`, "Admin");
  };

  const mainMenuItems = [
    { id: 'home', label: 'Platform Dashboard', icon: TrendingUp, count: null },
    { id: 'governance', label: 'Listing Governance', icon: ShieldCheck, count: listings.filter(l => l.status === 'pending').length },
    { id: 'iot', label: 'IoT Smart Bollards', icon: Radio, count: bollards.filter(b => b.status === 'offline').length ? `${bollards.filter(b => b.status === 'offline').length} offline` : null, countColor: 'bg-rose-100 text-rose-700' },
    { id: 'settlement', label: 'Financial Settlement', icon: Landmark, count: payouts.filter(p => p.status === 'pending').length },
    { id: 'enforcement', label: 'Overstay Enforcement', icon: AlertOctagon, count: overstays.filter(o => o.status !== 'resolved').length, countColor: 'bg-rose-100 text-rose-700' },
    { id: 'support', label: 'Disputes & Tickets', icon: LifeBuoy, count: tickets.filter(t => t.status !== 'resolved').length },
    { id: 'audit', label: 'System Audit', icon: ShieldAlert, count: null }
  ];

  const bottomMenuItems = [
    { id: 'system', label: 'System Configuration', icon: Lock, count: null }
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case 'home':
        return (
          <DashboardHome 
            stats={stats} 
            setStats={setStats}
            activityLogs={activityLogs} 
            systemConfig={systemConfig}
            setSystemConfig={setSystemConfig}
          />
        );
      case 'governance':
        return (
          <ListingGovernance 
            listings={listings} 
            onApprove={handleApproveListing} 
            onReject={handleRejectListing}
            addActivityLog={addActivityLog}
          />
        );
      case 'iot':
        return (
          <IotHealthMonitor 
            bollards={bollards} 
            setBollards={setBollards}
            addActivityLog={addActivityLog}
          />
        );
      case 'settlement':
        return (
          <FinanceSettlement 
            payouts={payouts} 
            setPayouts={setPayouts}
            transactions={transactions}
            setTransactions={setTransactions}
            addActivityLog={addActivityLog}
            commissionRate={systemConfig.commissionRate}
          />
        );
      case 'enforcement':
        return (
          <OverstayEnforcement 
            overstays={overstays} 
            setOverstays={setOverstays}
            addActivityLog={addActivityLog}
            gracePeriodMinutes={systemConfig.gracePeriodMinutes}
          />
        );
      case 'support':
        return (
          <SupportDispute 
            tickets={tickets} 
            setTickets={setTickets}
            transactions={transactions}
            setTransactions={setTransactions}
            addActivityLog={addActivityLog}
            onLowerBollard={handleLowerBollard}
          />
        );
      case 'audit':
        return (
          <SystemAudit 
            activityLogs={activityLogs}
            addActivityLog={addActivityLog}
          />
        );
      case 'system':
        return (
          <SystemConfiguration 
            systemConfig={systemConfig}
            setSystemConfig={setSystemConfig}
            stats={stats}
            setStats={setStats}
            onNavigateHome={() => setActiveView('home')}
          />
        );
    }
  };

  return (
    <div id="parkjom-root" className="page-shell font-sans text-[#1d1d1f] flex">
      
      {/* 1. Sidebar — Dark Meta-style */}
      <aside className="hidden lg:flex flex-col w-[240px] bg-[#0f1115] text-[#9ca3af] border-r border-white/[0.06] shrink-0 select-none">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#111] text-[13px]">PJ</div>
          <div>
            <span className="text-white font-bold text-[15px] tracking-[-0.02em]">ParkJom</span>
            <span className="text-[10px] text-[#6b7280] font-medium tracking-wider uppercase block leading-none mt-0.5">Admin Console</span>
          </div>
        </div>

        {/* Dev badge */}
        <div className="mx-4 my-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px]">
          <span className="text-[10px] font-semibold text-[#60a5fa] uppercase tracking-wider">Lead Developer</span>
          <p className="text-[#d1d5db] font-medium mt-0.5">Chaw Chun Jia</p>
          <span className="text-[10px] text-[#6b7280]">Student B • Backend &amp; IoT</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {mainMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as ActiveView)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white text-[#111]'
                    : 'text-[#9ca3af] hover:bg-white/[0.04] hover:text-[#d1d5db]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent size={15} className={isActive ? 'text-[#007AFF]' : 'text-[#6b7280]'} />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count !== 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#e8f0fe] text-[#007AFF]' : 'bg-white/[0.06] text-[#9ca3af]'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Bottom section */}
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <span className="text-[9px] font-semibold text-[#6b7280] uppercase tracking-wider px-3 pb-1.5 block">Administration</span>
          {bottomMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as ActiveView)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${isActive ? 'bg-[#fef3c7]/10 text-[#fbbf24]' : 'text-[#6b7280] hover:bg-white/[0.04] hover:text-[#9ca3af]'}`}
              >
                <IconComponent size={15} /> {item.label}
              </button>
            );
          })}
        </div>

        {/* Sign out + version */}
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium text-[#9ca3af] hover:bg-white/[0.04] hover:text-[#d1d5db] transition-all duration-150"
          >
            <LogOut size={15} /> Sign out
          </button>
          <div className="px-3 pt-2 text-[10px] text-[#4b5563] font-medium">
            v1.0.4 &middot; System stable
          </div>
        </div>
      </aside>

      {/* 2. Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Header visible on mobile only — sidebar replaces it on desktop */}
        <div className="lg:hidden">
          <DashboardHeader
            role="admin"
            showMenuButton
            onMenuClick={() => setSidebarOpen(true)}
            statusText="All systems operational"
          />
        </div>

        {/* Main Workspace Frame */}
        <main className="flex-1 p-6 overflow-y-auto max-w-[1500px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderActiveView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* 3. Mobile Sidebar Drawer Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden select-none">
            {/* Dimmer backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Slide Drawer — Dark style matching desktop */}
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="relative flex flex-col w-[260px] max-w-xs bg-[#0f1115] text-[#9ca3af] h-full border-r border-white/[0.06]"
            >
              <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#111] text-[13px]">PJ</div>
                  <div>
                    <span className="text-white font-bold text-[15px] tracking-[-0.02em]">ParkJom</span>
                    <span className="text-[10px] text-[#6b7280] font-medium tracking-wider uppercase block leading-none mt-0.5">Admin</span>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-[#6b7280] hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="mx-4 my-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[11px]">
                <span className="text-[10px] font-semibold text-[#60a5fa] uppercase tracking-wider">Lead Developer</span>
                <p className="text-[#d1d5db] font-medium mt-0.5">Chaw Chun Jia (Student B)</p>
              </div>

              <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
                {mainMenuItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveView(item.id as ActiveView); setSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${isActive ? 'bg-white text-[#111]' : 'text-[#9ca3af] hover:bg-white/[0.04] hover:text-[#d1d5db]'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComponent size={15} className={isActive ? 'text-[#007AFF]' : 'text-[#6b7280]'} />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== null && item.count !== 0 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#e8f0fe] text-[#007AFF]' : 'bg-white/[0.06] text-[#9ca3af]'}`}>{item.count}</span>
                      )}
                    </button>
                  );
                })}
                <div className="border-t border-white/[0.06] pt-2 mt-2">
                  <span className="text-[9px] font-semibold text-[#6b7280] uppercase tracking-wider px-3 pb-1.5 block">Administration</span>
                  {bottomMenuItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveView(item.id as ActiveView); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 ${isActive ? 'bg-[#fef3c7]/10 text-[#fbbf24]' : 'text-[#6b7280] hover:bg-white/[0.04] hover:text-[#9ca3af]'}`}
                      >
                        <IconComponent size={15} /> {item.label}
                      </button>
                    );
                  })}
                </div>
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <BottomNav
        items={[
          { id: 'home', icon: TrendingUp, label: 'Dashboard' },
          { id: 'governance', icon: ShieldCheck, label: 'Listings', count: listings.filter((l) => l.status === 'pending').length },
          { id: 'iot', icon: Radio, label: 'Bollards', count: bollards.filter((b) => b.status === 'offline').length },
          { id: 'settlement', icon: Landmark, label: 'Finance' },
          { id: 'support', icon: LifeBuoy, label: 'Support', count: tickets.filter((t) => t.status !== 'resolved').length },
        ]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as ActiveView)}
      />

    </div>
  );
}
