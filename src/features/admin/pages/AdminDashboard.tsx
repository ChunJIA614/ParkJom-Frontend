import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShieldCheck, Radio, AlertOctagon, 
  Landmark, LifeBuoy,
  ShieldAlert, Lock, Menu, Car
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import BottomNav from '@/components/layout/BottomNav';
import PageTransition from '@/components/ui/PageTransition';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  fetchVerificationDocument,
  listVerificationRequests,
  submitVerificationDecision as postVerificationDecision,
} from '../api/verificationApi';
import { getAccessLogs } from '../api/accessLogApi';
import { getAllVehicles } from '../api/vehicleApi';
import { getSuspendedAccounts, reintegrateAccount, suspendAccount } from '../api/accountSuspensionApi';

import { 
  initialStats
} from '../data/mockData';
import { AccessLogDto, AccessLogPaginationState, AdminVehicleDto, IoTBollard, ListingRequest, OwnerPayout, Transaction, OverstayRecord, ParkingVerificationDecision, ParkingVerificationDecisionResponse, ParkingVerificationDecisionResult, ParkingVerificationDocumentDto, ParkingVerificationRequestDto, ParkingVerificationRequestResponse, ParkingVerificationRequestsResponse, VerificationRequestListStatus, VerificationRequestPaginationState } from '../types';

import DashboardHome from '../components/DashboardHome';
import ListingGovernance from '../components/ListingGovernance';
import IotHealthMonitor from '../components/IotHealthMonitor';
import FinanceSettlement from '../components/FinanceSettlement';
import OverstayEnforcement from '../components/OverstayEnforcement';
import SupportWorkspace from '@/features/support/components/SupportWorkspace';
import SystemAudit from '../components/SystemAudit';
import SystemConfiguration from '../components/SystemConfiguration';
import VehicleManagement from '../components/VehicleManagement';

type ActiveView = 'home' | 'governance' | 'vehicles' | 'iot' | 'settlement' | 'enforcement' | 'support' | 'audit' | 'system';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const token = user?.token ?? '';
  const supportViewer = React.useMemo(() => user ? ({
    userId: user.userId,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    role: 'Admin' as const,
    token: user.token,
  }) : null, [user]);
  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('parkjom_admin_sidebar_collapsed') === 'true',
  );

  useEffect(() => {
    localStorage.setItem('parkjom_admin_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // App core states — all data fetched from backend
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const saved = localStorage.getItem('parkjom_admin_view');
    const validViews: ActiveView[] = ['home', 'governance', 'vehicles', 'iot', 'settlement', 'enforcement', 'support', 'audit', 'system'];
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
  const [listingsStatus, setListingsStatus] = useState<VerificationRequestListStatus>('pending');
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsPageSize, setListingsPageSize] = useState(10);
  const [listingsPagination, setListingsPagination] = useState<VerificationRequestPaginationState>({
    source: 'client',
    page: 1,
    pageSize: 10,
    totalCount: null,
    totalPages: null,
    hasNextPage: false,
  });
  const [payouts, setPayouts] = useState<OwnerPayout[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overstays, setOverstays] = useState<OverstayRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<{ id: string; type: string; message: string; timestamp: string; user: string }[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogDto[]>([]);
  const [accessLogsLoading, setAccessLogsLoading] = useState(false);
  const [accessLogsError, setAccessLogsError] = useState<string | null>(null);
  const [accessLogsTotal, setAccessLogsTotal] = useState(0);
  const [accessLogsSearch, setAccessLogsSearch] = useState('');
  const [accessLogsPagination, setAccessLogsPagination] = useState<AccessLogPaginationState>({
    source: 'client',
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
  });
  const [adminVehicles, setAdminVehicles] = useState<AdminVehicleDto[]>([]);
  const [adminVehiclesLoading, setAdminVehiclesLoading] = useState(false);
  const [adminVehiclesError, setAdminVehiclesError] = useState<string | null>(null);

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
      activeOverstaysCount: overstays.filter(o => o.status !== 'resolved').length
    }));
  };

  const loadSuspendedAccounts = React.useCallback(async () => {
    if (!token) return [];
    return (await getSuspendedAccounts(token)).data;
  }, [token]);

  // ---- Fetch verification requests from backend (pending + moderated) ----
  const fetchListings = React.useCallback(async () => {
    if (!token) return;

    setListingsLoading(true);
    setListingsError(null);

    try {
      const res = await listVerificationRequests(token, {
        status: listingsStatus,
        page: listingsPage,
        pageSize: listingsPageSize,
      });
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
      const listEnvelope = isEnvelope && Array.isArray(body.data)
        ? body as ParkingVerificationRequestsResponse
        : null;

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
      const pagination = listEnvelope?.pagination;
      const hasPaginationMetadata = Boolean(
        pagination
        || typeof listEnvelope?.page === 'number'
        || typeof listEnvelope?.pageSize === 'number'
        || typeof listEnvelope?.totalCount === 'number'
        || typeof listEnvelope?.totalPages === 'number'
        || typeof listEnvelope?.hasNextPage === 'boolean',
      );
      // The current backend returns the complete list, even when page/pageSize
      // are supplied. Treat an oversized response as unpaginated so the UI
      // always honors the selected rows-per-page limit.
      const hasServerPagination = hasPaginationMetadata && responseData.length <= listingsPageSize;
      const pageSize = listingsPageSize;
      const statusFiltered = mapped.filter((listing) => listingsStatus === 'pending'
        ? listing.status === 'pending'
        : listing.status !== 'pending');
      const serverTotalCount = typeof listEnvelope?.totalCount === 'number'
        ? listEnvelope.totalCount
        : typeof pagination?.totalCount === 'number'
          ? pagination.totalCount
          : null;
      const serverTotalPages = typeof listEnvelope?.totalPages === 'number'
        ? listEnvelope.totalPages
        : typeof pagination?.totalPages === 'number'
          ? pagination.totalPages
          : serverTotalCount === null
            ? null
            : Math.max(1, Math.ceil(serverTotalCount / pageSize));
      const serverPage = listEnvelope?.page
        || pagination?.page
        || pagination?.currentPage
        || listingsPage;
      const clientTotalPages = Math.max(1, Math.ceil(statusFiltered.length / pageSize));
      const responsePage = hasServerPagination
        ? serverPage
        : Math.min(listingsPage, clientTotalPages);
      const totalCount = hasServerPagination ? serverTotalCount : statusFiltered.length;
      const totalPages = hasServerPagination ? serverTotalPages : clientTotalPages;
      const hasNextPage = hasServerPagination
        ? typeof listEnvelope?.hasNextPage === 'boolean'
          ? listEnvelope.hasNextPage
          : typeof pagination?.hasNextPage === 'boolean'
            ? pagination.hasNextPage
            : totalPages !== null
              ? responsePage < totalPages
              : statusFiltered.length >= pageSize
        : responsePage < clientTotalPages;
      const displayedListings = hasServerPagination
        ? statusFiltered
        : statusFiltered.slice((responsePage - 1) * pageSize, responsePage * pageSize);

      setListings(displayedListings);

      setListingsPagination({
        source: hasServerPagination ? 'server' : 'client',
        page: responsePage,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
      });
      if (listingsStatus === 'pending') {
        setStats(prev => ({ ...prev, pendingListingsCount: totalCount ?? displayedListings.length }));
      }
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : 'Unable to load verification requests.');
    } finally {
      setListingsLoading(false);
    }
  }, [listingsPage, listingsPageSize, listingsStatus, token]);

  const changeListingsStatus = React.useCallback((status: VerificationRequestListStatus) => {
    setListingsStatus(status);
    setListingsPage(1);
  }, []);

  const changeListingsPage = React.useCallback((page: number) => {
    setListingsPage(Math.max(1, Math.floor(page)));
  }, []);

  const changeListingsPageSize = React.useCallback((pageSize: number) => {
    if (![10, 20, 50].includes(pageSize)) return;
    setListingsPageSize(pageSize);
    setListingsPage(1);
    setListingsPagination((current) => ({
      ...current,
      page: 1,
      pageSize,
    }));
  }, []);

  const fetchAccessLogs = React.useCallback(async () => {
    if (!token) return;

    setAccessLogsLoading(true);
    setAccessLogsError(null);
    try {
      const requestedPage = accessLogsPagination.page;
      const requestedPageSize = accessLogsPagination.pageSize;
      const result = await getAccessLogs(token, {
        search: accessLogsSearch,
        page: requestedPage,
        pageSize: requestedPageSize,
      });

      setAccessLogs(result.data);
      setAccessLogsTotal(result.total);
      setAccessLogsPagination(() => {
        const pageSize = result.pageSize > 0 ? result.pageSize : requestedPageSize;
        const totalPages = Math.max(1, result.totalPages || Math.ceil(result.total / pageSize));
        const page = Math.min(totalPages, Math.max(1, result.page || requestedPage));
        return {
          source: 'server',
          page,
          pageSize,
          totalCount: result.total,
          totalPages,
          hasNextPage: page < totalPages,
        };
      });
    } catch (error) {
      setAccessLogsError(error instanceof Error ? error.message : 'Unable to load access logs.');
    } finally {
      setAccessLogsLoading(false);
    }
  }, [accessLogsPagination.page, accessLogsPagination.pageSize, accessLogsSearch, token]);

  const changeAccessLogsSearch = React.useCallback((search: string) => {
    setAccessLogsSearch(search);
    setAccessLogsPagination((current) => ({ ...current, page: 1 }));
  }, []);

  const changeAccessLogsPage = React.useCallback((page: number) => {
    setAccessLogsPagination((current) => {
      const nextPage = Math.min(current.totalPages, Math.max(1, Math.floor(page)));
      return {
        ...current,
        page: nextPage,
        hasNextPage: nextPage < current.totalPages,
      };
    });
  }, []);

  const changeAccessLogsPageSize = React.useCallback((pageSize: number) => {
    if (![10, 20, 50].includes(pageSize)) return;
    setAccessLogsPagination((current) => ({
      ...current,
      page: 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(current.totalCount / pageSize)),
      hasNextPage: current.totalCount > pageSize,
    }));
  }, []);

  const fetchAdminVehicles = React.useCallback(async () => {
    if (!token) return;

    setAdminVehiclesLoading(true);
    setAdminVehiclesError(null);
    try {
      const result = await getAllVehicles(token);
      setAdminVehicles(result.data);
    } catch (error) {
      setAdminVehiclesError(error instanceof Error ? error.message : 'Unable to load all vehicles.');
    } finally {
      setAdminVehiclesLoading(false);
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

  useEffect(() => {
    if (!token || activeView !== 'audit') return;
    const timer = window.setTimeout(() => {
      void fetchAccessLogs();
    }, accessLogsSearch.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [accessLogsSearch, activeView, fetchAccessLogs, token]);

  useEffect(() => {
    if (!token || activeView !== 'vehicles') return;
    void fetchAdminVehicles();
  }, [activeView, fetchAdminVehicles, token]);

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

  const adminSidebarGroups = [
    {
      items: [{ id: 'home', label: 'Platform Dashboard', icon: TrendingUp }],
    },
    {
      label: 'Operations',
      items: [
        { id: 'governance', label: 'Listing Governance', icon: ShieldCheck, badge: listings.filter((listing) => listing.status === 'pending').length },
        { id: 'vehicles', label: 'Vehicle Management', icon: Car },
        { id: 'iot', label: 'IoT Smart Bollards', icon: Radio, badge: bollards.filter((bollard) => bollard.status === 'offline').length, badgeTone: 'danger' as const },
      ],
    },
    {
      label: 'Finance & Safety',
      items: [
        { id: 'settlement', label: 'Financial Settlement', icon: Landmark, badge: payouts.filter((payout) => payout.status === 'pending').length },
        { id: 'enforcement', label: 'Overstay Enforcement', icon: AlertOctagon, badge: overstays.filter((overstay) => overstay.status !== 'resolved').length, badgeTone: 'danger' as const },
        { id: 'support', label: 'Disputes & Tickets', icon: LifeBuoy },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'audit', label: 'System Audit', icon: ShieldAlert },
        { id: 'system', label: 'System Configuration', icon: Lock },
      ],
    },
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
            statusFilter={listingsStatus}
            pagination={listingsPagination}
            onStatusChange={changeListingsStatus}
            onPageChange={changeListingsPage}
            onPageSizeChange={changeListingsPageSize}
            onRefresh={fetchListings}
            onViewDocument={fetchPrivateDocument}
            onApprove={handleApproveListing} 
            onReject={handleRejectListing}
            onSuspend={async (email) => (await suspendAccount(token, email)).data}
            onReintegrate={async (email) => (await reintegrateAccount(token, email)).data}
            onLoadSuspensions={loadSuspendedAccounts}
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
          supportViewer && <SupportWorkspace mode="admin" viewer={supportViewer} />
        );
      case 'audit':
        return (
          <SystemAudit
            accessLogs={accessLogs}
            isLoading={accessLogsLoading}
            error={accessLogsError}
            totalCount={accessLogsTotal}
            searchQuery={accessLogsSearch}
            pagination={accessLogsPagination}
            onSearchChange={changeAccessLogsSearch}
            onPageChange={changeAccessLogsPage}
            onPageSizeChange={changeAccessLogsPageSize}
            onRefresh={fetchAccessLogs}
          />
        );
      case 'vehicles':
        return (
          <VehicleManagement
            vehicles={adminVehicles}
            isLoading={adminVehiclesLoading}
            error={adminVehiclesError}
            onRefresh={fetchAdminVehicles}
          />
        );
<<<<<<< Updated upstream
=======
      case 'reviews':
        return (
          <ReviewModeration
            token={token}
            parkingSpots={listings.map((listing) => ({
              parkingSpotId: listing.parkingSpotId,
              label: listing.propertyName + (listing.parkingLabel ? ' · ' + listing.parkingLabel : ''),
            }))}
            onModerated={(message) => addActivityLog('review_moderation', message, 'Admin')}
          />
        );
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
    reviews: { title: 'Review traceability', description: 'Trace commuter feedback, parking lots, and owner responses from one review workspace.' },
>>>>>>> Stashed changes
    vehicles: { title: 'Vehicle management', description: 'Review commuter vehicles registered across the platform.' },
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
      <AppSidebar
        id="admin-workspace-navigation"
        workspaceLabel="Admin workspace"
        groups={adminSidebarGroups}
        activeId={activeView}
        onNavigate={(id) => setActiveView(id as ActiveView)}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        footer="Platform operations and governance."
      />

      {/* 2. Main Content */}
      <div className="workspace-main flex-1 flex flex-col min-w-0">
        <DashboardHeader
          role="admin"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => { setActiveView('home'); navigate('/admin', { replace: true }); }}
          showMenuButton
          onMenuClick={() => setSidebarOpen(true)}
          menuExpanded={sidebarOpen}
          menuControls="admin-workspace-navigation"
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

      <BottomNav
        items={[
          { id: 'home', icon: TrendingUp, label: 'Dashboard' },
          { id: 'governance', icon: ShieldCheck, label: 'Listings', count: listings.filter((l) => l.status === 'pending').length },
          { id: 'iot', icon: Radio, label: 'Bollards', count: bollards.filter((b) => b.status === 'offline').length },
          { id: 'settlement', icon: Landmark, label: 'Finance' },
          { id: 'more', icon: Menu, label: 'More' },
        ]}
        activeId={['vehicles', 'enforcement', 'support', 'audit', 'system'].includes(activeView) ? 'more' : activeView}
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
