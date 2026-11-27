import { parseTimestamp, displayDateOptions } from '@/lib/dateTime';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CreditCard,
  Wallet,
  Clock,
  MapPin,
  CheckCircle2,
  Camera,
  Search,
  ArrowLeft,
  AlertCircle,
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
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
  const returningFromPayment = searchParams.get('public_paid') === 'true' && Boolean(queryPlateOrCode);

  const [inputQuery, setInputQuery] = useState(queryPlateOrCode);
  const [session, setSession] = useState<PublicParkingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
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
      setPaymentSuccess(data.isPaid || data.status === 'Paid' || data.status === 'Exited');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No active session found.');
      setSession(null);
      setPaymentSuccess(false);
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
        })
        .catch(() => {});
    }
  }, [isLoggedIn, user?.token]);

  // Real-time ticking clock for parked duration
  useEffect(() => {
    if (!session || session.status === 'Exited' || session.exitTimeUtc) return;

    const entryTime = parseTimestamp(session.entryTimeUtc).getTime();
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
      } else {
        setError('The payment page could not be opened. Try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe checkout failed.');
    } finally {
      setIsProcessingPayment(false);
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
    setMobileMoreOpen(false);
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

  const paying = Boolean(session && !paymentSuccess);

  const mobileMoreGroups = useMemo(() => {
    const primaryIds = new Set(
      sidebarNavConfig.bottomNavItems
        .map((item) => item.id)
        .filter((id) => id !== 'more'),
    );
    return sidebarNavConfig.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !primaryIds.has(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [sidebarNavConfig.bottomNavItems, sidebarNavConfig.groups]);

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
              <p>Find your ticket by plate number or ticket code.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleBack}
                className="workspace-button workspace-button--secondary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              {session ? (
                <button type="button" disabled={isProcessingPayment} className="workspace-button workspace-button--secondary" onClick={() => {
                  setSession(null);
                  setInputQuery('');
                  setPaymentSuccess(false);
                  setError(null);
                  navigate({ search: '' }, { replace: true });
                }}>
                  Find another ticket
                </button>
              ) : (
                <button type="button" onClick={() => setShowScanner(true)} className="workspace-button workspace-button--secondary">
                  <Camera size={16} aria-hidden="true" />
                  Scan plate
                </button>
              )}
            </div>
          </div>

          <main className="mx-auto w-full max-w-xl space-y-4">
            {!session && (
              <form onSubmit={handleSearchSubmit} className="workspace-panel space-y-3 p-5">
                <label htmlFor="parking-ticket-lookup" className="block font-medium">Plate number or ticket code</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="parking-ticket-lookup"
                    type="text"
                    value={inputQuery}
                    onChange={(event) => setInputQuery(event.target.value.toUpperCase())}
                    placeholder="e.g. VAA 1234"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-base"
                  />
                  <button type="submit" disabled={loading || !inputQuery.trim()} className="workspace-button workspace-button--primary">
                    <Search size={16} aria-hidden="true" /> Find ticket
                  </button>
                </div>
              </form>
            )}

        {/* Error message */}
        {error && (
          <div role="alert" className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium tracking-wide">Retrieving parking ticket...</p>
          </div>
        )}

        {/* Active Ticket Card (Apple Design) */}
        {session && !loading && (
          <div className="space-y-6">
            {/* Ticket Card Shell */}
            <div className="workspace-panel overflow-hidden">
              {/* Top Accent Band */}
              <div className="p-6 border-b border-black/[0.05] dark:border-white/[0.06] flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
                    Ticket #{session.sessionCode}
                  </span>
                  <p className="text-lg font-semibold">{session.lotName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{session.lotAddress}</span>
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-medium text-muted-foreground mb-1">Plate Number</span>
                  <span className="workspace-status tabular-nums">
                    {session.carPlateNumber}
                  </span>
                </div>
              </div>

              {paymentSuccess ? (
                <div className="flex items-start gap-3 p-5" role="status">
                  <CheckCircle2 className="size-6 shrink-0 text-[var(--parkjom-success)]" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold">{session.status === 'Exited' || session.exitTimeUtc ? 'Parking session ended' : session.canExitFree ? 'Exit confirmed' : 'Payment complete'}</h2>
                    {!session.exitTimeUtc && session.status !== 'Exited' && (
                      <p className="text-sm text-muted-foreground">Use the exit barrier before your exit window ends.</p>
                    )}
                  </div>
                </div>
              ) : returningFromPayment ? (
                <div className="space-y-3 p-5">
                  <p role="status" className="font-semibold">Waiting for payment confirmation</p>
                  <p className="text-sm text-muted-foreground">Check the ticket again to confirm your payment before you exit.</p>
                  <button type="button" onClick={() => void fetchSession(queryPlateOrCode)} className="workspace-button workspace-button--primary">Check payment status</button>
                </div>
              ) : (
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold">Amount due</h2>
                    <span className="text-2xl font-semibold tabular-nums">
                      RM {session.canExitFree ? '0.00' : session.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  {!session.canExitFree && isLoggedIn && (
                    <fieldset disabled={isProcessingPayment} className="space-y-2">
                      <legend className="text-sm font-medium">Payment method</legend>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="workspace-payment-option">
                          <input type="radio" name="payment-method" checked={selectedMethod === 'stripe'} onChange={() => setSelectedMethod('stripe')} />
                          <CreditCard size={16} aria-hidden="true" /> Card or digital wallet
                        </label>
                        <label className="workspace-payment-option">
                          <input type="radio" name="payment-method" checked={selectedMethod === 'wallet'} onChange={() => setSelectedMethod('wallet')} />
                          <Wallet size={16} aria-hidden="true" /> ParkJom Wallet
                        </label>
                      </div>
                    </fieldset>
                  )}
                  {!session.canExitFree && isLoggedIn && selectedMethod === 'wallet' && (
                    <p className="text-sm text-muted-foreground">
                      {walletBalance === null ? 'Wallet balance unavailable.' : `Wallet balance RM ${walletBalance.toFixed(2)}.`}
                      {walletBalance !== null && walletBalance < session.totalAmount && ' Choose another payment method or top up your wallet.'}
                    </p>
                  )}
                  <button
                    type="button"
                    className="workspace-button workspace-button--primary w-full"
                    onClick={!session.canExitFree && isLoggedIn && selectedMethod === 'wallet' ? handlePayWallet : handlePayStripe}
                    aria-busy={isProcessingPayment}
                    disabled={isProcessingPayment || (!session.canExitFree && isLoggedIn && selectedMethod === 'wallet' && (walletBalance === null || walletBalance < session.totalAmount))}
                  >
                    {isProcessingPayment ? 'Processing…' : session.canExitFree ? 'Confirm free exit' : isLoggedIn && selectedMethod === 'wallet' ? 'Pay with ParkJom Wallet' : 'Continue to payment'}
                  </button>
                  {!isLoggedIn && !session.canExitFree && <p className="text-sm text-muted-foreground">Guest checkout is available. <Link to="/login" className="font-semibold text-primary underline underline-offset-2">Sign in</Link> to use ParkJom Wallet.</p>}
                </div>
              )}
              <details className="border-t border-border">
                <summary className="min-h-11 cursor-pointer px-5 py-3 font-semibold">Ticket details</summary>
                <dl className="space-y-2.5 px-5 pb-5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><Clock size={16} aria-hidden="true" /> Parked duration</dt>
                    <dd className="tabular-nums">{formatElapsed(elapsedSeconds || session.durationMinutes * 60)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Check-in time</dt>
                    <dd className="tabular-nums">{parseTimestamp(session.entryTimeUtc).toLocaleTimeString([], displayDateOptions({ hour: '2-digit', minute: '2-digit' }))}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Hourly rate</dt>
                    <dd className="tabular-nums">RM {session.hourlyRate.toFixed(2)} / hr</dd>
                  </div>
                  {!session.canExitFree && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Billable duration</dt>
                      <dd className="tabular-nums">{Math.max(1, Math.ceil((elapsedSeconds || session.durationMinutes * 60) / 3600))} hr</dd>
                    </div>
                  )}
                  {session.canExitFree && !paymentSuccess && (
                    <div className="flex justify-between gap-2 text-[var(--parkjom-success)]">
                      <dt>Free exit window</dt>
                      <dd>{session.graceMinutesRemaining} min left</dd>
                    </div>
                  )}
                  {Boolean(session.overnightSurchargeAmount && session.overnightSurchargeAmount > 0) && (
                    <div className="flex justify-between gap-2 text-[var(--parkjom-warning)]">
                      <dt>Overnight surcharge</dt>
                      <dd className="tabular-nums">RM {session.overnightSurchargeAmount?.toFixed(2)}</dd>
                    </div>
                  )}
                </dl>
              </details>
            </div>
          </div>
        )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {!paying && mobileMoreOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-[49]"
              onClick={() => setMobileMoreOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="menu"
              aria-label="More navigation options"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 360 }}
              style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
              className="md:hidden fixed right-3 z-[55] w-60 origin-bottom-right rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] p-1.5"
            >
              {mobileMoreGroups.map((group, groupIndex) => (
                <div
                  key={group.label}
                  className={groupIndex > 0 ? 'mt-1 pt-1 border-t border-black/[0.06] dark:border-white/[0.08]' : ''}
                >
                  <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] dark:text-[#71717a]">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = sidebarNavConfig.activeId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMobileMoreOpen(false);
                            handleWorkspaceNavigate(item.id);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#0071e3]/10 dark:bg-[#0a84ff]/20 text-[#0071e3] dark:text-[#409cff] font-semibold'
                              : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.07] font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon size={17} strokeWidth={isActive ? 2.2 : 1.9} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge != null && item.badge !== '' && (
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                isActive
                                  ? 'bg-[#0071e3]/15 dark:bg-[#0a84ff]/30 text-[#0071e3] dark:text-[#409cff]'
                                  : 'bg-black/[0.06] dark:bg-white/[0.1] text-[#6e6e73] dark:text-[#a1a1a6]'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!paying && <BottomNav
        items={sidebarNavConfig.bottomNavItems}
        activeId={mobileMoreOpen ? 'more' : sidebarNavConfig.bottomActiveId}
        onChange={(id) => {
          if (id === 'more') {
            setMobileMoreOpen((prev) => !prev);
            return;
          }
          setMobileMoreOpen(false);
          handleWorkspaceNavigate(id);
        }}
      />}

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
