import {
  AlertOctagon,
  Building2,
  Car,
  Landmark,
  LifeBuoy,
  Lock,
  Menu,
  Radio,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AppSidebarGroup } from '@/components/layout/AppSidebar';
import type { BottomNavItem } from '@/components/layout/BottomNav';
import type { DashboardSearchItem } from '@/components/layout/DashboardHeader';

export type AdminActiveView =
  | 'home'
  | 'governance'
  | 'users'
  | 'property-managers'
  | 'vehicles'
  | 'iot'
  | 'settlement'
  | 'enforcement'
  | 'support'
  | 'audit'
  | 'system'
  | 'broadcast';

export const ADMIN_VIEW_META: Record<AdminActiveView, { title: string; description: string }> = {
  home: { title: 'Operations overview', description: 'Monitor the queues and systems that affect today’s parking journeys.' },
  governance: { title: 'Listing governance', description: 'Review owner submissions and publish only verified supply.' },
  users: { title: 'User governance', description: 'Review, inspect, and manage registered ParkJom accounts and roles.' },
  'property-managers': { title: 'Property management accounts', description: 'Provision standalone building-desk accounts and manage 14-day single-use email invitations.' },
  vehicles: { title: 'Vehicle management', description: 'Review commuter vehicles registered across the platform.' },
  iot: { title: 'Smart bollards', description: 'Inspect access hardware health and intervene when a bay cannot serve a booking.' },
  settlement: { title: 'Settlement', description: 'Reconcile owner payouts and transaction records.' },
  enforcement: { title: 'Overstay enforcement', description: 'Resolve sessions that exceeded their confirmed parking window.' },
  support: { title: 'Disputes and support', description: 'Keep commuter and owner issues moving toward a clear resolution.' },
  audit: { title: 'System audit', description: 'Review operational actions and changes across the platform.' },
  broadcast: { title: 'Broadcast & notifications', description: 'Publish system alerts and audit delivery channels.' },
  system: { title: 'System configuration', description: 'Manage the controls that affect platform-wide behavior.' },
};

export interface AdminSidebarCounts {
  pendingListings?: number | null;
  offlineBollards?: number | null;
  pendingPayouts?: number | null;
  openOverstays?: number | null;
}

/** Builds the canonical Admin workspace sidebar groups. */
export function buildAdminSidebarGroups({
  pendingListings = null,
  offlineBollards = null,
  pendingPayouts = null,
  openOverstays = null,
}: AdminSidebarCounts = {}): AppSidebarGroup[] {
  return [
    {
      items: [{ id: 'home', label: 'Platform Dashboard', icon: TrendingUp }],
    },
    {
      label: 'Operations',
      items: [
        { id: 'governance', label: 'Listing Governance', icon: ShieldCheck, badge: pendingListings },
        { id: 'users', label: 'User Governance', icon: Users },
        { id: 'property-managers', label: 'Property Managers', icon: Building2 },
        { id: 'vehicles', label: 'Vehicle Management', icon: Car },
        { id: 'iot', label: 'IoT Smart Bollards', icon: Radio, badge: offlineBollards, badgeTone: 'danger' as const },
      ],
    },
    {
      label: 'Finance & Safety',
      items: [
        { id: 'settlement', label: 'Financial Settlement', icon: Landmark, badge: pendingPayouts },
        { id: 'enforcement', label: 'Overstay Enforcement', icon: AlertOctagon, badge: openOverstays, badgeTone: 'danger' as const },
        { id: 'support', label: 'Disputes & Tickets', icon: LifeBuoy },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'broadcast', label: 'Broadcast & Alerts', icon: Radio },
        { id: 'audit', label: 'System Audit', icon: ShieldAlert },
        { id: 'system', label: 'System Configuration', icon: Lock },
      ],
    },
  ];
}

export function buildAdminSearchItems(groups: AppSidebarGroup[]): DashboardSearchItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      keywords:
        item.id === 'settlement'
          ? ['finance', 'settlement', 'payouts', 'transactions']
          : [ADMIN_VIEW_META[item.id as AdminActiveView].title],
    }))
  );
}

export function buildAdminBottomNavItems(
  { pendingListings = 0, offlineBollards = 0 }: Pick<AdminSidebarCounts, 'pendingListings' | 'offlineBollards'> = {}
): BottomNavItem[] {
  return [
    { id: 'home', icon: TrendingUp, label: 'Dashboard' },
    { id: 'governance', icon: ShieldCheck, label: 'Listings', count: pendingListings },
    { id: 'iot', icon: Radio, label: 'Bollards', count: offlineBollards },
    { id: 'settlement', icon: Landmark, label: 'Finance' },
    { id: 'more', icon: Menu, label: 'More' },
  ];
}
