import { CalendarDays, DoorOpen, LayoutDashboard, ScanLine } from 'lucide-react';
import type { AppSidebarGroup } from '@/components/layout/AppSidebar';
import type { BottomNavItem } from '@/components/layout/BottomNav';
import type { DashboardSearchItem } from '@/components/layout/DashboardHeader';

export type ManagementView = 'overview' | 'scanner' | 'bookings' | 'access';

export const VALID_MANAGEMENT_VIEWS: ManagementView[] = ['overview', 'scanner', 'bookings', 'access'];

export const MANAGEMENT_SEARCH_ITEMS: DashboardSearchItem[] = [
  { id: 'overview', label: 'Property Overview', keywords: ['today', 'summary', 'building', 'desk'] },
  { id: 'scanner', label: 'Plate Scanner', keywords: ['camera', 'verify', 'license plate', 'jpj', 'gate'] },
  { id: 'bookings', label: 'Property Bookings', keywords: ['reservations', 'roster', 'schedule', 'vehicle'] },
  { id: 'access', label: 'Gate Entry Log', keywords: ['iot', 'bollard', 'entry', 'access events'] },
];

export const MANAGEMENT_VIEW_META: Record<ManagementView, { title: string; description: string }> = {
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

export const MANAGEMENT_SIDEBAR_GROUPS: AppSidebarGroup[] = [
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

export const MANAGEMENT_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'scanner', icon: ScanLine, label: 'Scanner' },
  { id: 'bookings', icon: CalendarDays, label: 'Bookings' },
  { id: 'access', icon: DoorOpen, label: 'Entries' },
];
