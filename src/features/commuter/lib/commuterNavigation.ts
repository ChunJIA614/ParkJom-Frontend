import {
  Car,
  ClipboardList,
  Compass,
  CreditCard,
  Heart,
  Map,
  Menu,
  Unlock,
  Wallet,
} from 'lucide-react';
import type { AppSidebarGroup } from '@/components/layout/AppSidebar';
import type { BottomNavItem } from '@/components/layout/BottomNav';
import type { DashboardSearchItem } from '@/components/layout/DashboardHeader';

export type CommuterTab =
  | 'home'
  | 'active'
  | 'wallet'
  | 'profile'
  | 'map'
  | 'favorites'
  | 'support'
  | 'publicPay';

export const COMMUTER_VIEW_META: Record<CommuterTab, { title: string; description: string }> = {
  home: { title: 'Parking near you', description: 'Compare verified bays around your route and choose with confidence.' },
  map: { title: 'Transit map', description: 'Choose a rail station and compare nearby verified parking bays.' },
  active: { title: 'My parking pass', description: 'Everything you need to arrive, unlock, park, and leave.' },
  wallet: { title: 'Wallet', description: 'Top up securely and keep track of every parking payment.' },
  profile: { title: 'Vehicles', description: 'Choose the vehicle attached to your next parking session.' },
  support: { title: 'Support', description: 'Report booking, access, wallet, payment, or account issues.' },
  favorites: { title: 'Favorites', description: 'Keep parking spaces you are interested in within easy reach.' },
  publicPay: { title: 'Express Drive-Out', description: 'Pay for drive-in public parking tickets instantly without queuing.' },
};

export const COMMUTER_RESTRICTED_TAB_LABELS: Record<string, string> = {
  active: 'My Parking Pass',
  wallet: 'Digital Wallet',
  profile: 'Vehicle Management',
  favorites: 'Saved Favorites',
  support: 'Customer Support',
};

export interface CommuterSidebarBadgeCounts {
  hasActiveBooking?: boolean;
  favoritesCount?: number | null;
  walletBalance?: number | null;
  vehiclesCount?: number | null;
}

/** Builds the canonical Commuter workspace sidebar groups. */
export function buildCommuterSidebarGroups({
  hasActiveBooking = false,
  favoritesCount = null,
  walletBalance = null,
  vehiclesCount = null,
}: CommuterSidebarBadgeCounts = {}): AppSidebarGroup[] {
  return [
    {
      label: 'Discover',
      items: [
        { id: 'home', icon: Compass, label: 'Browse' },
        { id: 'map', icon: Map, label: 'Transit Map' },
      ],
    },
    {
      label: 'My Parking',
      items: [
        { id: 'active', icon: Unlock, label: 'My Pass', dot: hasActiveBooking },
        { id: 'publicPay', icon: CreditCard, label: 'Express Drive-Out' },
        { id: 'favorites', icon: Heart, label: 'Favorites', badge: favoritesCount },
      ],
    },
    {
      label: 'Account',
      items: [
        {
          id: 'wallet',
          icon: Wallet,
          label: 'Wallet',
          badge: walletBalance === null ? null : `RM ${walletBalance.toFixed(2)}`,
        },
        { id: 'profile', icon: Car, label: 'Vehicles', badge: vehiclesCount },
        { id: 'support', icon: ClipboardList, label: 'Support' },
      ],
    },
  ];
}

/** Builds header quick-search entries matching the Commuter sidebar groups. */
export function buildCommuterSearchItems(groups: AppSidebarGroup[]): DashboardSearchItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      keywords:
        item.id === 'home'
          ? ['browse', 'parking near me', 'search parking']
          : item.id === 'active'
          ? ['parking pass', 'booking', 'reservation']
          : item.id === 'publicPay'
          ? ['express drive-out', 'public parking', 'ticket', 'pay parking']
          : [COMMUTER_VIEW_META[item.id as CommuterTab]?.title || item.label],
    }))
  );
}

/** Builds the mobile bottom navigation items matching the Commuter workspace. */
export function buildCommuterBottomNavItems(hasActivePassDot = false): BottomNavItem[] {
  return [
    { id: 'map', icon: Map, label: 'Transit' },
    { id: 'home', icon: Compass, label: 'Browse' },
    { id: 'active', icon: Unlock, label: 'Pass', dot: hasActivePassDot },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
    { id: 'more', icon: Menu, label: 'More' },
  ];
}
