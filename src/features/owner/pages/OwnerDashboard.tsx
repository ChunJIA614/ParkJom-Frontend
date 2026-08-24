import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, CalendarDays, PlusSquare, ClipboardList, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getMyParking,
  updateParkingAvailability,
  updateParkingPublication,
} from '../api/parkingApi';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BottomNav from '@/components/layout/BottomNav';
import PageTransition from '@/components/ui/PageTransition';
import DashboardHome from '../components/DashboardHome';
import AvailabilityScheduler from '../components/AvailabilityScheduler';
import PropertyOnboarding from '../components/PropertyOnboarding';
import SettingsPanel from '../components/SettingsPanel';
import SupportTickets from '../components/SupportTickets';
import {
  ParkingBay,
  Booking,
  Notification,
  WalletTransaction,
  MyParkingResponse,
  ParkingActionResult,
  ParkingAvailabilityStatus,
} from '../types';

function deriveParkingStatus(
  verificationStatus: string | number,
  isPublished: boolean,
): ParkingBay['status'] {
  const normalizedVerification = String(verificationStatus ?? '').toLowerCase();
  if (normalizedVerification === 'rejected' || normalizedVerification === '3') return 'Rejected';
  if (isPublished) return 'Active';
  if (
    normalizedVerification === 'approved'
    || normalizedVerification === 'verified'
    || normalizedVerification === '2'
  ) return 'Approved';
  return 'Pending Verification';
}

function normalizeParkingAvailability(value: string | number): ParkingAvailabilityStatus {
  const normalized = String(value ?? '').toLowerCase();
  const numericStatuses: Record<string, ParkingAvailabilityStatus> = {
    '0': 'Inactive',
    '1': 'Available',
    '2': 'Reserved',
    '3': 'Occupied',
  };
  const namedStatus = ['Inactive', 'Available', 'Reserved', 'Occupied'].find(
    (status) => status.toLowerCase() === normalized,
  );
  if (numericStatuses[normalized]) return numericStatuses[normalized];
  if (namedStatus) return namedStatus as ParkingAvailabilityStatus;
  return 'Inactive';
}

function loadNotifications(): Notification[] {
  try { const s = localStorage.getItem('parkjom_owner_notifs'); return s ? JSON.parse(s) : []; }
  catch { return []; }
}
function saveNotifications(notifs: Notification[]) {
  localStorage.setItem('parkjom_owner_notifs', JSON.stringify(notifs));
}

type OwnerView = 'dashboard' | 'availability' | 'registration' | 'settings' | 'tickets';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  // Navigation View Router — persist across reloads
  const [activeView, setActiveView] = useState<OwnerView>(() => {
    const saved = localStorage.getItem('parkjom_owner_view');
    const validViews: OwnerView[] = ['dashboard', 'availability', 'registration', 'settings', 'tickets'];
    return saved && validViews.includes(saved as OwnerView) ? saved as OwnerView : 'dashboard';
  });

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem('parkjom_owner_view', activeView);
  }, [activeView]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [configureParkingSpotId, setConfigureParkingSpotId] = useState<number | undefined>();
  const [configureParkingSection, setConfigureParkingSection] = useState<'setup' | 'timetable'>('setup');

  useEffect(() => {
    if (!isSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSidebarOpen]);

  // 1. Wallet Balance (RM) — TODO: fetch from backend
  const [walletBalance, setWalletBalance] = useState(0);

  // 2. Active Registered Parking Bays — fetched from backend
  const [bays, setBays] = useState<ParkingBay[]>([]);
  const [baysLoading, setBaysLoading] = useState(true);
  const [baysError, setBaysError] = useState<string | null>(null);
  const [baysMessage, setBaysMessage] = useState('');

  // 3. Recent Bookings History — TODO: fetch from backend
  const [bookings, setBookings] = useState<Booking[]>([]);

  // 4. Notifications — persisted to localStorage
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);

  // 5. Bank Beneficiary — TODO: fetch from backend
  const [activeBank, setActiveBank] = useState({ name: '-', accNo: '-', holder: '-' });

  // ---- Fetch parking spots from backend ----
  const fetchMyParking = useCallback(async () => {
    setBaysLoading(true);
    setBaysError(null);
    try {
      const token = user?.token ?? '';
      if (!token) throw new Error('Your owner session is missing an authorization token.');
      
      const res = await getMyParking(token);
      const body = await res.json().catch(() => null) as MyParkingResponse | null;
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Unable to retrieve parking spots (${res.status})`);
      }
      if (!Array.isArray(body.data)) {
        throw new Error('The parking response did not contain a data list.');
      }

      const mapped: ParkingBay[] = body.data.map((ps) => {
        const [labelBay = '', labelLevel = ''] = String(ps.parkingLabel ?? '').split('/', 2);

        return {
          ...ps,
          availabilityStatus: normalizeParkingAvailability(ps.availabilityStatus),
          id: `b-${ps.parkingSpotId}`,
          propertyName: `Property #${ps.propertyId}`,
          stationName: '—',
          bayNumber: labelBay || ps.parkingLabel || `Spot #${ps.parkingSpotId}`,
          level: labelLevel ? `Level ${labelLevel}` : 'Level —',
          status: deriveParkingStatus(ps.verificationStatus, ps.isPublished),
          hourlyRate: ps.dailyRate ?? 0,
          verificationSubmittedAt: ps.createdAt,
        };
      });
      setBays(mapped);
      setBaysMessage(`${body.message} (API ${body.code})`);
    } catch (error) {
      setBaysError(error instanceof Error ? error.message : 'Unable to retrieve your parking spots.');
    }
    finally { setBaysLoading(false); }
  }, [user?.token]);

  // Fetch on mount and when token changes
  useEffect(() => { fetchMyParking(); }, [fetchMyParking]);

  // Refetch bays when user returns to this tab (catches admin approve/reject updates)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMyParking();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchMyParking]);

  // Sync notifications to localStorage
  useEffect(() => { saveNotifications(notifications); }, [notifications]);

  // --- INTERACTION ACTION HANDLERS ---

  // Handle wallet withdrawals
  const handleWithdrawFunds = (amount: number) => {
    // 1. Subtract balance
    setWalletBalance(prev => prev - amount);

    // 2. Append transaction row to the tables list
    const today = new Date();
    const dateStr = today.getDate().toString().padStart(2, '0') + ' ' + 
                    today.toLocaleString('en-US', { month: 'short' }) + ' ' + 
                    today.getFullYear();

    const newWithdrawalRow: Booking = {
      id: `w-${Math.floor(Math.random() * 1000)}`,
      date: dateStr,
      renterPlate: 'WITHDRAWAL',
      renterName: 'Direct Bank Settlement',
      bayId: 'N/A',
      bayInfo: 'Fund Settlement',
      propertyName: 'Platform Wallet',
      duration: `${activeBank.name.split(' ')[0]} Transfer`,
      totalEarned: -amount,
      commissionPaid: 0,
      status: 'Upcoming' // Will show pending styled matching 'Upcoming'
    };

    setBookings(prev => [newWithdrawalRow, ...prev]);

    // 3. Create a success notification
    const newNotif: Notification = {
      id: `n-${Date.now()}`,
      title: 'Withdrawal Pending',
      message: `RM ${amount.toFixed(2)} requested for transfer to ${activeBank.name.split(' ')[0]} account Ending in ${activeBank.accNo.slice(-4)}.`,
      time: 'Just now',
      unread: true,
      type: 'payment'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Resolve disputes (Acknowledge overstay penalty and credit the wallet!)
  const handleResolveDispute = (bookingId: string) => {
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: 'Completed', totalEarned: b.totalEarned + 3.60 }; // Adds penalty RM 3.60
      }
      return b;
    }));

    // Credit overstay fine to balance
    setWalletBalance(prev => prev + 3.60);

    // Alert notification
    const newNotif: Notification = {
      id: `n-${Date.now()}`,
      title: 'Dispute Resolved & Paid',
      message: `Overstay penalty of RM 3.60 has been credited to your withdrawable wallet balance.`,
      time: 'Just now',
      unread: true,
      type: 'payment'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleUpdateParkingAvailability = async (
    parkingSpotId: number,
    availabilityStatus: ParkingAvailabilityStatus,
  ): Promise<ParkingActionResult> => {
    const token = user?.token ?? '';
    if (!token) return { success: false, message: 'Authentication required. Please log in again.' };

    try {
      const res = await updateParkingAvailability(token, parkingSpotId, availabilityStatus);
      const data = await res.json().catch(() => null) as {
        code?: number;
        success?: boolean;
        message?: string;
        parkingSpotId?: number;
        availabilityStatus?: ParkingAvailabilityStatus;
      } | null;

      if (!res.ok || data?.success !== true) {
        return {
          success: false,
          message: data?.message || `Unable to update parking availability (${res.status}).`,
        };
      }

      const confirmedStatus = data.availabilityStatus ?? availabilityStatus;
      setBays((current) => current.map((bay) => bay.parkingSpotId === parkingSpotId
        ? { ...bay, availabilityStatus: confirmedStatus, updatedAt: new Date().toISOString() }
        : bay));
      setNotifications((current) => [{
        id: `n-${Date.now()}`,
        title: 'Availability Updated',
        message: data.message || `Parking spot #${parkingSpotId} is now ${confirmedStatus}.`,
        time: 'Just now',
        unread: true,
        type: 'system',
      }, ...current]);

      return {
        success: true,
        message: data.message || `Parking spot #${parkingSpotId} is now ${confirmedStatus}.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to update parking availability.',
      };
    }
  };

  const handleUpdateParkingPublication = async (
    parkingSpotId: number,
    isPublished: boolean,
  ): Promise<ParkingActionResult> => {
    const token = user?.token ?? '';
    if (!token) return { success: false, message: 'Authentication required. Please log in again.' };

    try {
      const res = await updateParkingPublication(token, parkingSpotId, isPublished);
      const data = await res.json().catch(() => null) as {
        code?: number;
        success?: boolean;
        message?: string;
        parkingSpotId?: number;
        isPublished?: boolean;
      } | null;

      if (!res.ok || data?.success !== true) {
        return {
          success: false,
          message: data?.message || `Unable to update parking publication (${res.status}).`,
        };
      }

      const confirmedPublication = data.isPublished ?? isPublished;
      setBays((current) => current.map((bay) => bay.parkingSpotId === parkingSpotId
        ? {
            ...bay,
            isPublished: confirmedPublication,
            status: deriveParkingStatus(bay.verificationStatus, confirmedPublication),
            updatedAt: new Date().toISOString(),
          }
        : bay));
      setNotifications((current) => [{
        id: `n-${Date.now()}`,
        title: confirmedPublication ? 'Parking Published' : 'Parking Unpublished',
        message: data.message || `Parking spot #${parkingSpotId} was ${confirmedPublication ? 'published' : 'unpublished'}.`,
        time: 'Just now',
        unread: true,
        type: 'system',
      }, ...current]);

      return {
        success: true,
        message: data.message || `Parking spot #${parkingSpotId} was ${confirmedPublication ? 'published' : 'unpublished'}.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to update parking publication.',
      };
    }
  };

  // Register New Parking Spot Near Transit Stations
  // Parking creation is handled by POST /api/parking/create-parking in PropertyOnboarding.
  const handleOnboardProperty = (property: {
    propertyName: string;
    stationName: string;
    bayNumber: string;
    level: string;
    docName: string;
  }) => {
    const newNotif: Notification = {
      id: `n-${Date.now()}`,
      title: 'Registration Submitted',
      message: `${property.propertyName} (${property.bayNumber}) submitted for admin verification.`,
      time: 'Just now',
      unread: true,
      type: 'system'
    };
    setNotifications(prev => [newNotif, ...prev]);
    fetchMyParking();
  };

  // Save payout Bank Account settings
  const handleSaveBank = (bankDetails: { name: string; accNo: string; holder: string }) => {
    setActiveBank(bankDetails);
  };

  // Clear unread notification badge count
  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const openParkingWorkspace = (parkingSpotId: number, section: 'setup' | 'timetable') => {
    setConfigureParkingSpotId(parkingSpotId);
    setConfigureParkingSection(section);
    setActiveView('availability');
  };

  const viewMeta: Record<string, { title: string; description: string }> = {
    dashboard: { title: 'Parking status', description: 'See the current booking readiness and today’s status for every property parking spot.' },
    availability: { title: 'Configure parking', description: 'Keep one-time parking details separate from the availability timetable you manage day to day.' },
    registration: { title: 'Register a property', description: 'Submit a bay for verification and configure it for bookings.' },
    tickets: { title: 'Support', description: 'Track booking, access, and settlement issues.' },
    settings: { title: 'Settings', description: 'Manage payout details and workspace preferences.' },
  };
  const currentViewMeta = viewMeta[activeView] ?? viewMeta.dashboard;

  return (
    <div className="app-workspace font-sans text-[#1d1d1f] flex" data-workspace-role="owner">
      {/* Responsive Sidebar */}
      <Sidebar 
        activeView={activeView} 
        onViewChange={(view) => setActiveView(view as OwnerView)}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main content viewport wrapper */}
      <div className="flex-1 flex flex-col lg:ml-60 min-h-screen min-w-0">
        {/* Top Navbar */}
        <Header
          notifications={notifications}
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => { setActiveView('dashboard'); navigate('/owner', { replace: true }); }}
          onMarkAllRead={handleMarkAllRead}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Render View Panels */}
        <main className="workspace-frame flex-1">
          {activeView === 'dashboard' && (
            <div className="workspace-heading">
              <div>
                <h1>{currentViewMeta.title}</h1>
                <p>{currentViewMeta.description}</p>
              </div>
            </div>
          )}
          <PageTransition transitionKey={activeView}>
          {activeView === 'dashboard' && (
            <DashboardHome 
              walletBalance={walletBalance} 
              onWithdraw={handleWithdrawFunds}
              bookings={bookings}
              bays={bays}
              baysLoading={baysLoading}
              baysError={baysError}
              baysMessage={baysMessage}
              onRefreshBays={fetchMyParking}
              onUpdateAvailability={handleUpdateParkingAvailability}
              onUpdatePublication={handleUpdateParkingPublication}
              activeBank={activeBank}
              onResolveDispute={handleResolveDispute}
              onConfigureParking={(parkingSpotId) => openParkingWorkspace(parkingSpotId, 'setup')}
              onOpenTimetable={(parkingSpotId) => openParkingWorkspace(parkingSpotId, 'timetable')}
            />
          )}

          {activeView === 'availability' && (
            <AvailabilityScheduler 
              bays={bays}
              initialParkingSpotId={configureParkingSpotId}
              initialSection={configureParkingSection}
            />
          )}

          {activeView === 'registration' && (
            <PropertyOnboarding 
              onOnboardProperty={handleOnboardProperty}
            />
          )}

          {activeView === 'settings' && (
            <SettingsPanel 
              bank={activeBank}
              onSaveBank={handleSaveBank}
            />
          )}

          {activeView === 'tickets' && (
            <SupportTickets />
          )}
          </PageTransition>
        </main>

      </div>

      <BottomNav
        items={[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
          { id: 'availability', icon: CalendarDays, label: 'Configure' },
          { id: 'registration', icon: PlusSquare, label: 'Register' },
          { id: 'tickets', icon: ClipboardList, label: 'Support' },
          { id: 'settings', icon: Sliders, label: 'Settings' },
        ]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as OwnerView)}
      />
    </div>
  );
}
