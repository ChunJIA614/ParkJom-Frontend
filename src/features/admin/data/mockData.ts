import { IoTBollard, ListingRequest, OwnerPayout, Transaction, OverstayRecord, SupportTicket, PlatformStats } from '../types';

// TODO: All data will be fetched from backend APIs
export const initialStats: PlatformStats = {
  totalRevenue: 0,
  platformCommission: 0,
  activeBookings: 0,
  totalUsers: 0,
  onlineBollardsRate: 0,
  pendingListingsCount: 0,
  openDisputesCount: 0,
  activeOverstaysCount: 0
};

export const initialBollards: IoTBollard[] = [];
export const initialListings: ListingRequest[] = [];
export const initialPayouts: OwnerPayout[] = [];
export const initialTransactions: Transaction[] = [];
export const initialOverstays: OverstayRecord[] = [];

export const initialTickets: SupportTicket[] = [];
export const initialActivityLogs: { id: string; type: string; message: string; timestamp: string; user: string }[] = [];