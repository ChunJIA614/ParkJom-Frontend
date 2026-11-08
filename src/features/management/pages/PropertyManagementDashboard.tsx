import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, DoorOpen, LayoutDashboard, ScanLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import AppSidebar from '@/components/layout/AppSidebar';
import BottomNav from '@/components/layout/BottomNav';
import DashboardHeader, { type DashboardSearchItem } from '@/components/layout/DashboardHeader';
import PageTransition from '@/components/ui/PageTransition';
import ManagementOverview from '../components/ManagementOverview';
import ManagementPlateScanner from '../components/ManagementPlateScanner';
import ManagementBookingsPanel from '../components/ManagementBookingsPanel';
import ManagementAccessEventsPanel from '../components/ManagementAccessEventsPanel';

type ManagementView = 'overview' | 'scanner' | 'bookings' | 'access';

const VALID_VIEWS: ManagementView[] = ['overview', 'scanner', 'bookings', 'access'];

const SEARCH_ITEMS: DashboardSearchItem[] = [
  { id: 'overview', label: 'Property Overview', keywords: ['today', 'summary', 'building', 'desk'] },
  { id: 'scanner', label: 'Plate Scanner', keywords: ['camera', 'verify', 'license plate', 'jpj', 'gate'] },
  { id: 'bookings', label: 'Property Bookings', keywords: ['reservations', 'roster', 'schedule', 'vehicle'] },
  { id: 'access', label: 'Gate Entry Log', keywords: ['iot', 'bollard', 'entry', 'access events'] },
];

const VIEW_META: Record<ManagementView, { title: string; description: string }> = {
  overview: {
    title: 'Property operations',
    description: 'Live vehicle arrivals, active bookings, and gatehouse verification for your assigned building.',
  },
  scanner: {
    title: 'Plate scanner',
    description: 'Scan or upload a Malaysian vehicle number plate to verify an eligible booking right now.',
  },
  bookings: {
    title: 'Property bookings',
    description: 'Inspect and filter every parking reservation scheduled at your assigned property.',
  },
  access: {
    title: 'Gate entry log',
    description: 'Review physical entry events confirmed by smart-bollard hardware across your property.',
  },
};

export default function PropertyManagementDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const token = user?.token ?? '';

  const [activeView, setActiveView] = useState<ManagementView>(() => {
    const saved = localStorage.getItem('parkjom_management_view');
    return saved && VALID_VIEWS.includes(saved as ManagementView) ? (saved as ManagementView) : 'overview';
  });

  useEffect(() => {
    localStorage.setItem('parkjom_management_view', activeView);
  }, [activeView]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('parkjom_management_sidebar_collapsed') === 'true',
  );

  useEffect(() => {
    localStorage.setItem('parkjom_management_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const [knownSpots, setKnownSpots] = useState<Array<{ id: number; label: string }>>([]);
  const [focusedBookingId, setFocusedBookingId] = useState<number | null>(null);

  const mergeKnownSpots = useCallback((discovered: Array<{ id: number; label: string }>) => {
    setKnownSpots((current) => {
      const map = new Map<number, string>();
      current.forEach((s) => map.set(s.id, s.label));
      discovered.forEach((s) => {
        if (s.id > 0 && !map.has(s.id)) map.set(s.id, s.label);
      });
      if (map.size === current.length) return current;
      return Array.from(map.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.id - b.id);
    });
  }, []);

  const handleOpenBooking = (bookingId: number) => {
    setFocusedBookingId(bookingId);
    setActiveView('bookings');
  };

  const propertyName = user?.propertyName || (user?.propertyId ? `Property #${user.propertyId}` : 'Assigned Property');
  const propertyAddress = user?.propertyAddress || '';
  const currentMeta = VIEW_META[activeView];

  const sidebarGroups = [
    {
      label: 'Gatehouse Desk',
      items: [
        { id: 'overview', label: 'Property Overview', icon: LayoutDashboard },
        { id: 'scanner', label: 'Plate Scanner', icon: ScanLine },
        { id: 'bookings', label: 'Property Bookings', icon: CalendarDays },
        { id: 'access', label: 'Gate Entry Log', icon: DoorOpen },
      ],
    },
  ];

  return (
    <div className="app-workspace font-sans text-[#1d1d1f] flex" data-workspace-role="management">
      <AppSidebar
        id="management-workspace-navigation"
        workspaceLabel={propertyName}
        groups={sidebarGroups}
        activeId={activeView}
        onNavigate={(id) => setActiveView(id as ManagementView)}
        onBrandClick={() => { setActiveView('overview'); navigate('/management', { replace: true }); }}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        footer={propertyAddress || 'Property-scoped bookings & vehicle access.'}
      />

      <div className="workspace-main flex-1 flex flex-col min-h-screen min-w-0">
        <DashboardHeader
          role="management"
          user={user}
          onSignOut={() => { logout(); navigate('/'); }}
          onBrandClick={() => { setActiveView('overview'); navigate('/management', { replace: true }); }}
          showMenuButton
          onMenuClick={() => setSidebarOpen((open) => !open)}
          menuExpanded={sidebarOpen}
          menuControls="management-workspace-navigation"
          statusText={propertyName}
          badge={{ label: 'On Duty', variant: 'success' }}
          hideDesktopBrand
          searchItems={SEARCH_ITEMS}
          onSearchSelect={(id) => {
            setActiveView(id as ManagementView);
            setSidebarOpen(false);
          }}
        />

        <main className="workspace-frame flex-1 pb-24 md:pb-10">
          <div className="workspace-heading">
            <div>
              <h1>{currentMeta.title}</h1>
              <p>{currentMeta.description}</p>
            </div>
          </div>

          <PageTransition transitionKey={activeView}>
            {activeView === 'overview' && (
              <ManagementOverview
                token={token}
                propertyName={propertyName}
                propertyAddress={propertyAddress}
                onNavigateView={(view) => setActiveView(view)}
                onInspectBooking={handleOpenBooking}
                onKnownSpotsDiscovered={mergeKnownSpots}
              />
            )}

            {activeView === 'scanner' && (
              <ManagementPlateScanner
                token={token}
                knownSpots={knownSpots}
                onOpenBooking={handleOpenBooking}
              />
            )}

            {activeView === 'bookings' && (
              <ManagementBookingsPanel
                token={token}
                knownSpots={knownSpots}
                focusedBookingId={focusedBookingId}
                onClearFocusedBooking={() => setFocusedBookingId(null)}
                onKnownSpotsDiscovered={mergeKnownSpots}
              />
            )}

            {activeView === 'access' && (
              <ManagementAccessEventsPanel
                token={token}
                knownSpots={knownSpots}
                onOpenBooking={handleOpenBooking}
                onKnownSpotsDiscovered={mergeKnownSpots}
              />
            )}
          </PageTransition>
        </main>
      </div>

      {/* 4 top-level tabs — no More overflow needed */}
      <BottomNav
        items={[
          { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
          { id: 'scanner', icon: ScanLine, label: 'Scanner' },
          { id: 'bookings', icon: CalendarDays, label: 'Bookings' },
          { id: 'access', icon: DoorOpen, label: 'Entries' },
        ]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as ManagementView)}
      />
    </div>
  );
}
