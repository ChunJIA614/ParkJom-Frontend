import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Layers,
  Menu,
  MessageSquare,
  PlusSquare,
  Radio,
  Sliders,
  Wallet,
} from 'lucide-react';
import type { AppSidebarGroup } from '@/components/layout/AppSidebar';
import type { BottomNavItem } from '@/components/layout/BottomNav';
import type { DashboardSearchItem } from '@/components/layout/DashboardHeader';

export type OwnerView =
  | 'dashboard'
  | 'publicParking'
  | 'availability'
  | 'reviews'
  | 'registration'
  | 'iot'
  | 'wallet'
  | 'settings'
  | 'tickets';

export const OWNER_SIDEBAR_GROUPS: AppSidebarGroup[] = [
  {
    label: 'Parking',
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'publicParking', label: 'Public Drive-In', icon: Layers },
      { id: 'availability', label: 'Configure Parking', icon: CalendarDays },
      { id: 'reviews', label: 'Reviews', icon: MessageSquare },
      { id: 'registration', label: 'Register Property', icon: PlusSquare },
      { id: 'iot', label: 'Smart Bollards', icon: Radio },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'wallet', label: 'Earnings Wallet', icon: Wallet },
      { id: 'tickets', label: 'Support', icon: ClipboardList },
      { id: 'settings', label: 'Settings', icon: Sliders },
    ],
  },
];

export const OWNER_SEARCH_ITEMS: DashboardSearchItem[] = [
  { id: 'dashboard', label: 'Overview', keywords: ['dashboard', 'parking status', 'bookings'] },
  { id: 'publicParking', label: 'Public Drive-In Lots', keywords: ['public parking', 'drive-in', 'hourly', 'carplate', 'turnover', 'capacity'] },
  { id: 'availability', label: 'Configure Parking', keywords: ['availability', 'schedule', 'timetable'] },
  { id: 'reviews', label: 'Reviews', keywords: ['feedback', 'owner replies'] },
  { id: 'registration', label: 'Register Property', keywords: ['onboarding', 'new parking', 'bay'] },
  { id: 'iot', label: 'Smart Bollards', keywords: ['iot', 'device', 'bollard', 'otp', 'pairing', 'unlock'] },
  { id: 'wallet', label: 'Earnings Wallet', keywords: ['wallet', 'earnings', 'payout', 'balance', 'transactions'] },
  { id: 'tickets', label: 'Support', keywords: ['tickets', 'issues', 'help'] },
  { id: 'settings', label: 'Settings', keywords: ['payout', 'bank account', 'preferences'] },
];

export const OWNER_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
  { id: 'availability', icon: CalendarDays, label: 'Configure' },
  { id: 'reviews', icon: MessageSquare, label: 'Reviews' },
  { id: 'registration', icon: PlusSquare, label: 'Register' },
  { id: 'more', icon: Menu, label: 'More' },
];
