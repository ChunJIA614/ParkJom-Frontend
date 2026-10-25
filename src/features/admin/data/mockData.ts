import { IoTBollard, ListingRequest, OwnerPayout, Transaction, OverstayRecord, SupportTicket, PlatformStats } from '../types';

// Every collection starts empty. Nothing here is illustrative sample data —
// the admin screens render what the backend returns, or an explicit empty state.
export const initialStats: PlatformStats = {
  totalRevenue: 0,
  platformCommission: 0,
  grossBookingValue: 0,
  ownerPayoutTotal: 0,
  activeBookings: 0,
  totalUsers: 0,
  totalOwners: 0,
  totalCommuters: 0,
  onlineBollardsRate: 0,
  totalBollards: 0,
  onlineBollards: 0,
  pendingListingsCount: 0,
  openDisputesCount: 0,
  activeOverstaysCount: 0,
  openTicketsCount: 0
};

export const initialBollards: IoTBollard[] = [];
export const initialListings: ListingRequest[] = [];
export const initialPayouts: OwnerPayout[] = [];
export const initialTransactions: Transaction[] = [];
export const initialOverstays: OverstayRecord[] = [];

export const initialTickets: SupportTicket[] = [];
export const initialActivityLogs: { id: string; type: string; message: string; timestamp: string; user: string }[] = [];
