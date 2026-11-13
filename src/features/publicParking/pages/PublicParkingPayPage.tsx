import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  Wallet,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Camera,
  Search,
  ArrowLeft,
  QrCode,
  AlertCircle,
  Car,
} from 'lucide-react';
import AppSidebar from '@/components/layout/AppSidebar';
import BottomNav from '@/components/layout/BottomNav';
import DashboardHeader, { type DashboardRole } from '@/components/layout/DashboardHeader';
import { useAuth } from '@/features/auth/context/AuthContext';
import { NotificationBell } from '@/features/notifications';
import {
  buildAdminBottomNavItems,
  buildAdminSearchItems,
  buildAdminSidebarGroups,
} from '@/features/admin/lib/adminNavigation';
import {
  buildCommuterBottomNavItems,
  buildCommuterSearchItems,
  buildCommuterSidebarGroups,
  COMMUTER_RESTRICTED_TAB_LABELS,
} from '@/features/commuter/lib/commuterNavigation';
import { getWalletSummary } from '@/features/commuter/api/walletApi';
import {
  MANAGEMENT_BOTTOM_NAV_ITEMS,
  MANAGEMENT_SEARCH_ITEMS,
  MANAGEMENT_SIDEBAR_GROUPS,
} from '@/features/management/lib/managementNavigation';
import {
  OWNER_BOTTOM_NAV_ITEMS,
  OWNER_SEARCH_ITEMS,
  OWNER_SIDEBAR_GROUPS,
} from '@/features/owner/lib/ownerNavigation';
import {
  lookupPublicSession,
  checkoutPublicWallet,
  checkoutPublicStripe,
  recordPublicExit,
} from '../api/publicParkingApi';
import type { PublicParkingSession } from '../types';
import { AppleScannerView } from '../components/AppleScannerView';

export default function PublicParkingPayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoggedIn, isGuest, continueAsGuest, promptLogin, logout } = useAuth();

  const role = user?.role;
  const headerRole: DashboardRole =
    role === 'Owner'
      ? 'owner'
      : role === 'Admin'
      ? 'admin'
      : role === 'PropertyManagement'
      ? 'management'
      : 'commuter';

  const collapsedStorageKey =
    headerRole === 'owner'
      ? 'parkjom_owner_sidebar_collapsed'
      : headerRole === 'admin'
      ? 'parkjom_admin_sidebar_collapsed'
      : headerRole === 'management'
      ? 'parkjom_management_sidebar_collapsed'
      : 'parkjom_commuter_sidebar_collapsed';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(collapsedStorageKey) === 'true',
  );

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(collapsedStorageKey) === 'true');
  }, [collapsedStorageKey]);

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey, String(sidebarCollapsed));
  }, [collapsedStorageKey, sidebarCollapsed]);

  const queryPlateOrCode = searchParams.get('plate') || searchParams.get('session') || searchParams.get('sessionCode') || '';
  const stripePaidFlag = searchParams.get('public_paid') === 'true';

  const [inputQuery, setInputQuery] = useState(queryPlateOrCode);
  const [session, setSession] = useState<PublicParkingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(stripePaidFlag);
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'wallet'>('stripe');

  // Elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch session
  const fetchSession = async (codeOrPlate: string) => {
    if (!codeOrPlate.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await lookupPublicSession(codeOrPlate);
      setSession(data);
      if (data.isPaid) {
        setPaymentSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No active session found.');
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryPlateOrCode) {
      void fetchSession(queryPlateOrCode);
    }
  }, [queryPlateOrCode]);

  // Load wallet balance if logged in
  useEffect(() => {
    if (isLoggedIn && user?.token) {
      getWalletSummary(user.token)
        .then((res) => {
          setWalletBalance(res.balance);
          if (res.balance > 0) {
            setSelectedMethod('wallet');
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn, user?.token]);

  // Real-time ticking clock for parked duration
  useEffect(() => {
    if (!session || session.status === 'Exited' || session.exitTimeUtc) return;

    const entryTime = new Date(session.entryTimeUtc).getTime();
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - entryTime) / 1000));
      setElapsedSeconds(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const formatElapsed = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins}m ${secs}s`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      void fetchSession(inputQuery);
    }
  };

  const handlePayWallet = async () => {
    if (!session) return;
    setIsProcessingPayment(true);
    setError(null);
    try {
      const updated = await checkoutPublicWallet(session.sessionCode);
      setSession(updated);
      setPaymentSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet payment failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePayStripe = async () => {
    if (!session) return;
    setIsProcessingPayment(true);
    setError(null);
    try {
      const res = await checkoutPublicStripe(session.sessionCode, 'web');
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else if (res.sessionId === 'FREE_GRACE') {
        // Free grace period exit
        setPaymentSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe checkout failed.');
      setIsProcessingPayment(false);
    }
  };

  const handleTestExit = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await recordPublicExit(session.publicParkingLotId, session.carPlateNumber);
      setSession(res);
      alert('Exit barrier opened! Spot is now released. Have a safe drive!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exit validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const sidebarNavConfig = useMemo(() => {
    if (headerRole === 'owner') {
      return {
        id: 'owner-workspace-navigation',
        workspaceLabel: 'Owner workspace',
        groups: OWNER_SIDEBAR_GROUPS,
        activeId: 'publicParking',
        footer: 'Parking supply and availability in one workspace.',
        searchItems: OWNER_SEARCH_ITEMS,
        bottomNavItems: OWNER_BOTTOM_NAV_ITEMS,
        bottomActiveId: 'more',
        defaultReturnPath: '/owner',
      };
    }
    if (headerRole === 'admin') {
      const groups = buildAdminSidebarGroups();
      return {
        id: 'admin-workspace-navigation',
        workspaceLabel: 'Admin workspace',
        groups,
        activeId: '',
        footer: 'Platform operations and governance.',
        searchItems: buildAdminSearchItems(groups),
        bottomNavItems: buildAdminBottomNavItems(),
        bottomActiveId: 'more',
        defaultReturnPath: '/admin',
      };
    }
    if (headerRole === 'management') {
      const propertyName = user?.propertyName || (user?.propertyId ? `Property #${user.propertyId}` : 'Assigned Property');
      return {
        id: 'management-workspace-navigation',
        workspaceLabel: propertyName,
        groups: MANAGEMENT_SIDEBAR_GROUPS,
        activeId: '',
        footer: user?.propertyAddress || 'Property-scoped bookings & vehicle access.',
        searchItems: MANAGEMENT_SEARCH_ITEMS,
        bottomNavItems: MANAGEMENT_BOTTOM_NAV_ITEMS,
        bottomActiveId: '',
        defaultReturnPath: '/management',
      };
    }
    const groups = buildCommuterSidebarGroups({
      walletBalance: isLoggedIn ? walletBalance : null,
    });
    return {
      id: 'commuter-workspace-navigation',
      workspaceLabel: 'Commuter workspace',
      groups,
      activeId: 'publicPay',
      footer: 'Find, book, and manage transit parking.',
      searchItems: buildCommuterSearchItems(groups),
      bottomNavItems: buildCommuterBottomNavItems(false),
      bottomActiveId: 'more',
      defaultReturnPath: '/commuter?tab=home',
    };
  }, [headerRole, isLoggedIn, user?.propertyAddress, user?.propertyId, user?.propertyName, walletBalance]);

  const handleWorkspaceNavigate = (id: string) => {
    setSidebarOpen(false);
    if (headerRole === 'owner') {
      try { localStorage.setItem('parkjom_owner_view', id); } catch {}
      navigate(`/owner?view=${encodeURIComponent(id)}`);
      return;
    }
    if (headerRole === 'admin') {
      try { localStorage.setItem('parkjom_admin_view', id); } catch {}
      navigate('/admin');
      return;
    }
    if (headerRole === 'management') {
      try { localStorage.setItem('parkjom_management_view', id); } catch {}
      navigate('/management');
      return;
    }

    if (id === 'publicPay') return;

    if (!isLoggedIn && !['home', 'map'].includes(id)) {
      const featureLabel = COMMUTER_RESTRICTED_TAB_LABELS[id] || 'This Feature';
      promptLogin(
        featureLabel,
        `Sign in to access ${featureLabel}, view active bookings, and manage your account.`,
      );
      return;
    }

    if (!isLoggedIn && !isGuest) {
      continueAsGuest();
    }
    try { localStorage.setItem('parkjom_commuter_tab', id); } catch {}
    navigate(`/commuter?tab=${encodeURIComponent(id)}`);
  };

  const handleBrandClick = () => {
    setSidebarOpen(false);
    if (headerRole === 'commuter' && !isLoggedIn && !isGuest) {
      continueAsGuest();
    }
    navigate(sidebarNavConfig.defaultReturnPath, { replace: true });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    handleBrandClick();
  };

  const notificationActions = (
    <div
      onClickCapture={(e) => {
        if (!isLoggedIn || !user?.token) {
          e.stopPropagation();
          e.preventDefault();
          promptLogin(
            'Notifications',
            'Sign in to view your real-time booking alerts and parking notifications.',
          );
        }
      }}
    >
      <NotificationBell
        onNavigate={(url) => {
          if (!isLoggedIn || !user?.token) {
            promptLogin(
              'Notifications',
              'Sign in to view your real-time booking alerts and parking notifications.',
            );
            return;
          }
          navigate(url);
        }}
      />
    </div>
  );

  return (
    <div
      className="app-workspace commuter-workspace page-shell text-[#1d1d1f] flex"
      data-workspace-role={headerRole}
    >
      <AppSidebar
        id={sidebarNavConfig.id}
        workspaceLabel={sidebarNavConfig.workspaceLabel}
        groups={sidebarNavConfig.groups}
        activeId={sidebarNavConfig.activeId}
        onNavigate={handleWorkspaceNavigate}
        onBrandClick={handleBrandClick}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        footer={sidebarNavConfig.footer}
      />

      <div className="workspace-main flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          role={headerRole}
          user={user}
          isGuest={!isLoggedIn}
          onSignIn={() => navigate('/login')}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={handleBrandClick}
          showMenuButton
          onMenuClick={() => setSidebarOpen(true)}
          menuExpanded={sidebarOpen}
          menuControls={sidebarNavConfig.id}
          actions={notificationActions}
          hideDesktopBrand
          searchItems={sidebarNavConfig.searchItems}
          onSearchSelect={(id) => {
            handleWorkspaceNavigate(id);
          }}
        />

        <div className="commuter-content-grid flex-1 max-w-[1180px] w-full mx-auto px-4 md:px-8 pt-4 lg:pt-6 pb-24 md:pb-10">
          <div className="workspace-heading workspace-heading--compact">
            <div>
              <h1>Express Drive-Out</h1>
              <p>Look up a vehicle plate or ticket code and settle drive-in public parking instantly.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1c1c1e] px-3.5 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-neutral-50 dark:hover:bg-[#2c2c2e] transition cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 px-4 text-xs font-semibold text-white transition shadow-xs cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Plate</span>
              </button>
            </div>
          </div>

          {/* Main Container */}
          <main className="min-h-0 max-w-xl mx-auto w-full space-y-6">
            {/* Search Bar / Input Card if no session loaded */}
            {(!session || !queryPlateOrCode) && (
              <div className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#0071e3]/10 text-[#0071e3]">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Public Parking Checkout</h2>
                    <p className="text-xs text-neutral-500">First-come first-serve • Pay only upon exit</p>
                  </div>
                </div>

                <form onSubmit={handleSearchSubmit} className="space-y-3">
                  <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Enter Vehicle Plate Number or Ticket Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value.toUpperCase())}
                      placeholder="e.g. VAA 1234 or PUB-..."
                      className="flex-1 h-12 px-4 rounded-2xl bg-neutral-100 dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] focus:border-[#0071e3] focus:bg-white dark:focus:bg-[#141417] font-mono text-base uppercase tracking-wider focus:outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={loading || !inputQuery.trim()}
                      className="h-12 px-5 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] active:scale-95 text-white font-medium text-sm transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      <span>Find</span>
                    </button>
                  </div>
                </form>

                <div className="pt-2 flex items-center justify-between text-xs text-neutral-400">
                  <span>Have physical barcode or plate?</span>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="text-[#0071e3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Open Scanner View</span>
                  </button>
                </div>
              </div>
            )}

        {/* Error message */}
        {error && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="text-xs opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="p-12 text-center text-neutral-400 space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium tracking-wide">Retrieving parking ticket...</p>
          </div>
        )}

        {/* Active Ticket Card (Apple Design) */}
        {session && !loading && (
          <div className="space-y-6">
            {/* Ticket Card Shell */}
            <div className="relative rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.06] dark:border-white/[0.08] shadow-[0_10px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl overflow-hidden transition-all">
              {/* Top Accent Band */}
              <div className="p-6 border-b border-black/[0.05] dark:border-white/[0.06] flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-400">
                    Ticket #{session.sessionCode}
                  </span>
                  <h3 className="text-xl font-bold tracking-tight">{session.lotName}</h3>
                  <p className="text-xs text-neutral-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{session.lotAddress}</span>
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-medium text-neutral-400 mb-1">Plate Number</span>
                  <span className="px-3.5 py-1.5 rounded-xl bg-black dark:bg-neutral-800 text-white font-mono text-base font-bold tracking-widest border border-white/10 shadow-xs">
                    {session.carPlateNumber}
                  </span>
                </div>
              </div>

              {/* Real-time Parking Clock */}
              <div className="p-6 bg-gradient-to-b from-neutral-50/50 dark:from-neutral-900/40 to-transparent border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs">
                    <Clock className="w-4 h-4 text-[#0071e3]" />
                    <span>Parked Duration</span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Check-in: {new Date(session.entryTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-mono text-3xl font-extrabold tracking-tight text-[#0071e3]">
                    {formatElapsed(elapsedSeconds || session.durationMinutes * 60)}
                  </div>

                  {session.canExitFree && !paymentSuccess && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[#34c759]/15 text-[#34c759] font-medium">
                      Free Grace ({session.graceMinutesRemaining}m left)
                    </span>
                  )}
                </div>
              </div>

              {/* Itemized Calculation */}
              <div className="p-6 space-y-3 text-sm">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Standard Hourly Rate</span>
                  <span className="font-mono">RM {session.hourlyRate.toFixed(2)} / hr</span>
                </div>

                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Billable Duration</span>
                  <span className="font-mono">
                    {Math.ceil(Math.max(1, elapsedSeconds / 3600))} hour(s)
                  </span>
                </div>

                {session.canExitFree && (
                  <div className="flex justify-between text-[#34c759] text-xs font-medium">
                    <span>Drop-off Grace Period Waiver</span>
                    <span>- RM {session.hourlyRate.toFixed(2)}</span>
                  </div>
                )}

                {Boolean(session.overnightSurchargeAmount && session.overnightSurchargeAmount > 0) && (
                  <div className="flex justify-between text-[#ff9500] text-xs font-medium">
                    <span>Overnight Overstay Surcharge</span>
                    <span className="font-mono">+ RM {session.overnightSurchargeAmount?.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex justify-between items-baseline">
                  <span className="text-base font-semibold">Total Amount Due</span>
                  <div className="text-right">
                    <span className="font-mono text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                      RM {session.canExitFree ? '0.00' : session.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Digital Exit Pass if Already Paid */}
              {paymentSuccess ? (
                <div className="p-6 bg-[#34c759]/10 border-t border-[#34c759]/20 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-[#34c759] text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-base text-[#1d1d1f] dark:text-white">
                        Payment Completed! Exit Pass Active
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">
                        Please drive through the exit barrier within 15 minutes.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-black/50 border border-black/[0.05] dark:border-white/[0.1] text-center space-y-2">
                    <QrCode className="w-24 h-24 mx-auto text-black dark:text-white p-1" />
                    <span className="font-mono text-xs tracking-wider uppercase text-neutral-400">
                      SCAN AT BOOM GATE SENSOR
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestExit}
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-[#34c759] hover:bg-[#30b753] active:scale-98 text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Simulate Boom Gate Exit (Release Spot)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Payment Options Area */
                <div className="p-6 bg-neutral-50/70 dark:bg-[#161617]/70 border-t border-black/[0.05] dark:border-white/[0.06] space-y-4">
                  {/* Segmented Controller (Apple Style) */}
                  <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/5 dark:bg-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('stripe')}
                      className={`h-9 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 ${
                        selectedMethod === 'stripe'
                          ? 'bg-white dark:bg-[#2c2c2e] text-black dark:text-white shadow-xs'
                          : 'hover:text-black dark:hover:text-white'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Apple Pay / Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod('wallet')}
                      className={`h-9 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 ${
                        selectedMethod === 'wallet'
                          ? 'bg-white dark:bg-[#2c2c2e] text-black dark:text-white shadow-xs'
                          : 'hover:text-black dark:hover:text-white'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>ParkJom Wallet</span>
                    </button>
                  </div>

                  {/* Stripe / Apple Pay Button (Guest Friendly, No Login Needed) */}
                  {selectedMethod === 'stripe' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handlePayStripe}
                        disabled={isProcessingPayment}
                        className="w-full h-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-semibold text-base transition-all duration-200 active:scale-98 hover:opacity-95 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessingPayment ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Pay with Stripe / Apple Pay</span>
                            <ChevronRight className="w-4 h-4 opacity-70" />
                          </>
                        )}
                      </button>
                      <p className="text-[11px] text-center text-neutral-400">
                        Direct guest checkout • No account or login required
                      </p>
                    </div>
                  )}

                  {/* ParkJom Wallet Button (For Logged In Commuters) */}
                  {selectedMethod === 'wallet' && (
                    <div className="space-y-3">
                      {isLoggedIn ? (
                        <>
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="text-neutral-500">Your Wallet Balance:</span>
                            <span className="font-mono font-bold text-sm">
                              RM {(walletBalance ?? 0).toFixed(2)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handlePayWallet}
                            disabled={isProcessingPayment || (walletBalance ?? 0) < session.totalAmount}
                            className="w-full h-14 rounded-2xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-base transition-all duration-200 active:scale-98 shadow-[0_4px_20px_rgba(0,113,227,0.35)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isProcessingPayment ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>Double-Tap to Pay with Wallet</span>
                                <ChevronRight className="w-4 h-4 opacity-70" />
                              </>
                            )}
                          </button>

                          {(walletBalance ?? 0) < session.totalAmount && (
                            <p className="text-[11px] text-center text-amber-500">
                              Insufficient balance. Top up your wallet or pay via Stripe above.
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-center space-y-2">
                          <p className="text-xs text-neutral-600 dark:text-neutral-400">
                            Log in with your ParkJom account to use your Wallet balance.
                          </p>
                          <Link
                            to="/login"
                            className="inline-block px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium text-xs hover:opacity-90 transition-all"
                          >
                            Sign In to Pay with Wallet
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Apple Privacy & Guarantee Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Encrypted Stripe Checkout • Instant Barrier Clearance</span>
            </div>
          </div>
        )}
          </main>
        </div>
      </div>

      <BottomNav
        items={sidebarNavConfig.bottomNavItems}
        activeId={sidebarNavConfig.bottomActiveId}
        onChange={(id) => {
          if (id === 'more') {
            setSidebarOpen(true);
            return;
          }
          handleWorkspaceNavigate(id);
        }}
      />

      {/* Optical Scanner Modal */}
      {showScanner && (
        <AppleScannerView
          onScanPlate={(plate) => {
            setShowScanner(false);
            setInputQuery(plate);
            void fetchSession(plate);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
