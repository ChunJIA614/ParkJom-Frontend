import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, ShieldCheck, Radio, AlertOctagon, 
  Landmark, LifeBuoy, X, LogOut,
  ShieldAlert, Lock, Menu
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import BottomNav from '@/components/layout/BottomNav';
import PageTransition from '@/components/ui/PageTransition';
import BrandLogo from '@/components/ui/BrandLogo';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  fetchVerificationDocument,
  listVerificationRequests,
  submitVerificationDecision as postVerificationDecision,
} from '../api/verificationApi';

import { 
  initialStats
} from '../data/mockData';
import { IoTBollard, ListingRequest, OwnerPayout, Transaction, OverstayRecord, SupportTicket, ParkingVerificationDecision, ParkingVerificationDecisionResponse, ParkingVerificationDecisionResult, ParkingVerificationDocumentDto, ParkingVerificationRequestDto, ParkingVerificationRequestResponse, ParkingVerificationRequestsResponse } from '../types';

import DashboardHome from '../components/DashboardHome';
import ListingGovernance from '../components/ListingGovernance';
import IotHealthMonitor from '../components/IotHealthMonitor';
import FinanceSettlement from '../components/FinanceSettlement';
import OverstayEnforcement from '../components/OverstayEnforcement';
import SupportDispute from '../components/SupportDispute';
import SystemAudit from '../components/SystemAudit';
import SystemConfiguration from '../components/SystemConfiguration';

type ActiveView = 'home' | 'governance' | 'iot' | 'settlement' | 'enforcement' | 'support' | 'audit' | 'system';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const token = user?.token ?? '';
  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [sidebarOpen]);

  // App core states — all data fetched from backend
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const saved = localStorage.getItem('parkjom_admin_view');
    const validViews: ActiveView[] = ['home', 'governance', 'iot', 'settlement', 'enforcement', 'support', 'audit', 'system'];
    return saved && validViews.includes(saved as ActiveView) ? saved as ActiveView : 'home';
  });

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem('parkjom_admin_view', activeView);
  }, [activeView]);
  const [stats, setStats] = useState(initialStats);
  const [bollards, setBollards] = useState<IoTBollard[]>([]);
  const [listings, setListings] = useState<ListingRequest[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [listingsMessage, setListingsMessage] = useState('');
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
    if (!token) return;

    setListingsLoading(true);
    setListingsError(null);

    try {
      const res = await listVerificationRequests(token);
      const body = await res.json().catch(() => null) as ParkingVerificationRequestsResponse | ParkingVerificationRequestResponse | ParkingVerificationRequestDto[] | null;
      const isEnvelope = body !== null && !Array.isArray(body);

      if (!res.ok || (isEnvelope && body.success === false)) {
        throw new Error((isEnvelope && body.message) || `Unable to load verification requests (${res.status})`);
      }

      const responsePayload = Array.isArray(body) ? body : body?.data;
      const responseData = Array.isArray(responsePayload)
        ? responsePayload
        : responsePayload
          ? [responsePayload]
          : null;
      if (!responseData) throw new Error('The verification request response did not contain verification data.');

      const textStatusMap: Record<string, Exclude<ListingRequest['status'], 'unknown'>> = {
        pending: 'pending',
        approved: 'approved',
        rejected: 'rejected',
      };
      const numericStatusMap: Record<number, Exclude<ListingRequest['status'], 'unknown'>> = {
        0: 'pending',
        1: 'pending',
        2: 'approved',
        3: 'rejected',
      };
      const statusLabels: Record<Exclude<ListingRequest['status'], 'unknown'>, string> = {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
      };

      const mapped: ListingRequest[] = responseData.map((v) => {
        const numericStatus = typeof v.verificationStatus === 'number'
          ? v.verificationStatus
          : Number(v.verificationStatus);
        const status = Number.isNaN(numericStatus)
          ? textStatusMap[String(v.verificationStatus).toLowerCase()] ?? 'unknown'
          : numericStatusMap[numericStatus] ?? 'unknown';

        return {
          ...v,
          documents: Array.isArray(v.documents) ? v.documents : [],
          id: String(v.verificationRequestId),
          verificationStatusLabel: status === 'unknown'
            ? String(v.verificationStatus)
            : statusLabels[status],
          status,
        };
      });
      setListings(mapped);
      setListingsMessage(isEnvelope
        ? `${body.message} (API ${body.code})`
        : `${mapped.length} verification request${mapped.length === 1 ? '' : 's'} retrieved successfully`);
      setStats(prev => ({ ...prev, pendingListingsCount: mapped.filter(l => l.status === 'pending').length }));
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : 'Unable to load verification requests.');
    } finally {
      setListingsLoading(false);
    }
  }, [token]);

  const fetchPrivateDocument = React.useCallback(async (document: ParkingVerificationDocumentDto) => {
    if (!token) throw new Error('Your admin session is missing an authorization token.');

    const normalizedFormat = document.format.trim().toLowerCase();
    const requestedContentType = normalizedFormat === 'pdf'
      ? 'application/pdf'
      : normalizedFormat === 'png'
        ? 'image/png'
        : 'image/jpeg';

    const res = await fetchVerificationDocument(token, document.mediaFileId, requestedContentType);

    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      const errorBody = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : null;
      throw new Error(errorBody?.message || `Unable to load document ${document.mediaFileId} (${res.status})`);
    }

    const file = await res.blob();
    if (file.size === 0) throw new Error(`Document ${document.mediaFileId} was empty.`);

    return file.type === requestedContentType
      ? file
      : new Blob([file], { type: requestedContentType });
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

  const submitVerificationDecision = async (
    id: string,
    decision: ParkingVerificationDecision,
    reviewNotes: string,
  ): Promise<ParkingVerificationDecisionResult> => {
    const actionLabel = decision === 'approved' ? 'approve' : 'reject';

    try {
      const listing = listings.find(l => l.id === id);
      if (!listing) return { success: false, message: `Verification request ${id} was not found.` };
      if (!token) return { success: false, message: 'Your admin session is missing an authorization token.' };

      const res = await postVerificationDecision(token, listing.verificationRequestId, decision, reviewNotes);
      const data = await res.json().catch(() => null) as ParkingVerificationDecisionResponse | null;

      if (res.ok && data?.success === true) {
        await fetchListings();
        const message = data?.message || `Verification request #${listing.verificationRequestId} ${decision} successfully.`;
        addActivityLog(
          'governance',
          `${message} Request #${data?.verificationRequestId ?? listing.verificationRequestId}; parking spot #${data?.parkingSpotId ?? listing.parkingSpotId}; status ${data?.verificationStatus ?? decision}; updated ${data?.updatedAt ?? 'now'}.`,
          'Admin',
        );
        return { success: true, message };
      }

      const message = data?.message || `Unable to ${actionLabel} verification request ${id} (${res.status}).`;
      addActivityLog('governance', message, 'Admin');
      return { success: false, message };
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : `Network error while attempting to ${actionLabel} verification request ${id}.`;
      addActivityLog('governance', message, 'Admin');
      return { success: false, message };
    }
  };

  const handleApproveListing = (id: string) =>
    submitVerificationDecision(id, 'approved', 'Ownership document approved.');

  const handleRejectListing = (id: string, reason: string) =>
    submitVerificationDecision(id, 'rejected', reason);

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
            isLoading={listingsLoading}
            error={listingsError}
            responseMessage={listingsMessage}
            onRefresh={fetchListings}
            onViewDocument={fetchPrivateDocument}
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

  const viewMeta: Record<ActiveView, { title: string; description: string }> = {
    home: { title: 'Operations overview', description: 'Monitor the queues and systems that affect today’s parking journeys.' },
    governance: { title: 'Listing governance', description: 'Review owner submissions and publish only verified supply.' },
    iot: { title: 'Smart bollards', description: 'Inspect access hardware health and intervene when a bay cannot serve a booking.' },
    settlement: { title: 'Settlement', description: 'Reconcile owner payouts and transaction records.' },
    enforcement: { title: 'Overstay enforcement', description: 'Resolve sessions that exceeded their confirmed parking window.' },
    support: { title: 'Disputes and support', description: 'Keep commuter and owner issues moving toward a clear resolution.' },
    audit: { title: 'System audit', description: 'Review operational actions and changes across the platform.' },
    system: { title: 'System configuration', description: 'Manage the controls that affect platform-wide behavior.' },
  };
  const currentViewMeta = viewMeta[activeView];

  return (
    <div id="parkjom-root" className="app-workspace font-sans text-[#1d1d1f] flex" data-workspace-role="admin">
      
      <aside className="workspace-sidebar hidden lg:flex">
        <div className="workspace-sidebar__brand">
          <div className="workspace-wordmark">
            <BrandLogo alt="" className="workspace-wordmark__mark" />
            <div><strong>ParkJom</strong><span>Admin workspace</span></div>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Admin workspace">
          {mainMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
              onClick={() => setActiveView(item.id as ActiveView)}
              className={isActive ? 'is-active' : ''}
              aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconComponent size={15} />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count !== 0 && (
                  <span className="ml-auto text-[10px] font-semibold text-[#6e6e73]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="mt-auto pt-3 border-t border-black/[0.06]">
          {bottomMenuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id as ActiveView)}
                className={isActive ? 'is-active' : ''}
                aria-current={isActive ? 'page' : undefined}
              >
                <IconComponent size={15} /> {item.label}
              </button>
            );
          })}
          </div>
        </nav>

        <div className="workspace-sidebar__footer">
          <button
            type="button"
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2.5 text-left hover:text-[#1d1d1f]"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* 2. Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        <DashboardHeader
          role="admin"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => { setActiveView('home'); navigate('/admin', { replace: true }); }}
          showMenuButton
          onMenuClick={() => setSidebarOpen(true)}
          menuExpanded={sidebarOpen}
          menuControls="admin-mobile-navigation"
          statusText="Operations workspace"
        />

        {/* Main Workspace Frame */}
        <main className="workspace-frame flex-1 overflow-y-auto">
          {activeView === 'home' && (
            <div className="workspace-heading">
              <div><h1>{currentViewMeta.title}</h1><p>{currentViewMeta.description}</p></div>
            </div>
          )}
          <PageTransition transitionKey={activeView}>
            {renderActiveView()}
          </PageTransition>
        </main>
      </div>

      {/* 3. Mobile Sidebar Drawer Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[60] flex lg:hidden select-none">
            {/* Dimmer backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            />

            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.38 }}
              id="admin-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="workspace-sidebar is-open"
            >
              <div className="workspace-sidebar__brand">
                <div className="workspace-wordmark">
                  <BrandLogo alt="" className="workspace-wordmark__mark" />
                  <div><strong>ParkJom</strong><span>Admin workspace</span></div>
                </div>
                <button type="button" onClick={() => setSidebarOpen(false)} className="text-[#6e6e73] p-1.5" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>

              <nav className="workspace-nav" aria-label="Admin workspace">
                {mainMenuItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveView(item.id as ActiveView); setSidebarOpen(false); }}
                      className={isActive ? 'is-active' : ''}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComponent size={15} />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== null && item.count !== 0 && (
                        <span className="ml-auto text-[10px] font-semibold text-[#6e6e73]">{item.count}</span>
                      )}
                    </button>
                  );
                })}
                <div className="mt-auto pt-3 border-t border-black/[0.06]">
                  {bottomMenuItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setActiveView(item.id as ActiveView); setSidebarOpen(false); }}
                        className={isActive ? 'is-active' : ''}
                        aria-current={isActive ? 'page' : undefined}
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
          { id: 'more', icon: Menu, label: 'More', count: tickets.filter((t) => t.status !== 'resolved').length },
        ]}
        activeId={['enforcement', 'support', 'audit', 'system'].includes(activeView) ? 'more' : activeView}
        onChange={(id) => {
          if (id === 'more') {
            setSidebarOpen(true);
            return;
          }
          setActiveView(id as ActiveView);
        }}
      />

    </div>
  );
}
