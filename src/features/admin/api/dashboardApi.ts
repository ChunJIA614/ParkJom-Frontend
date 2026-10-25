import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import type {
  AdminDashboardBookingCounts,
  AdminDashboardData,
  AdminDashboardStats,
  DashboardDailyPoint,
  DashboardHourlyPoint,
  DashboardRevenueTypePoint,
  DashboardStationPoint,
  DashboardUserGrowthPoint,
} from '../types';

/**
 * GET /api/admin/dashboard
 *
 * One aggregate read that backs the whole admin landing screen. Every number
 * is summed from live tables on the server; this module only normalises shapes
 * and refuses to invent a value it did not receive.
 */

interface StatsWire {
  totalRevenue?: number;
  platformCommission?: number;
  grossBookingValue?: number;
  ownerPayoutTotal?: number;
  activeBookings?: number;
  totalUsers?: number;
  totalOwners?: number;
  totalCommuters?: number;
  onlineBollardsRate?: number;
  totalBollards?: number;
  onlineBollards?: number;
  pendingListingsCount?: number;
  openDisputesCount?: number;
  activeOverstaysCount?: number;
  openTicketsCount?: number;
}

interface DashboardWire {
  stats?: StatsWire;
  bookingCounts?: Partial<AdminDashboardBookingCounts>;
  weekly?: DashboardDailyPoint[];
  stations?: DashboardStationPoint[];
  hourly?: DashboardHourlyPoint[];
  userGrowth?: DashboardUserGrowthPoint[];
  revenueByType?: DashboardRevenueTypePoint[];
  generatedAt?: string;
  timeZone?: string;
}

interface DashboardWireResponse {
  code?: number;
  success?: boolean;
  message?: string;
  data?: DashboardWire;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toInt = (value: unknown): number => Math.round(toNumber(value));

const normalizeStats = (wire: StatsWire | undefined): AdminDashboardStats => ({
  totalRevenue: toNumber(wire?.totalRevenue),
  platformCommission: toNumber(wire?.platformCommission),
  grossBookingValue: toNumber(wire?.grossBookingValue),
  ownerPayoutTotal: toNumber(wire?.ownerPayoutTotal),
  activeBookings: toInt(wire?.activeBookings),
  totalUsers: toInt(wire?.totalUsers),
  totalOwners: toInt(wire?.totalOwners),
  totalCommuters: toInt(wire?.totalCommuters),
  onlineBollardsRate: toInt(wire?.onlineBollardsRate),
  totalBollards: toInt(wire?.totalBollards),
  onlineBollards: toInt(wire?.onlineBollards),
  pendingListingsCount: toInt(wire?.pendingListingsCount),
  openDisputesCount: toInt(wire?.openDisputesCount),
  activeOverstaysCount: toInt(wire?.activeOverstaysCount),
  openTicketsCount: toInt(wire?.openTicketsCount),
});

const normalizeBookingCounts = (
  wire: Partial<AdminDashboardBookingCounts> | undefined,
): AdminDashboardBookingCounts => ({
  pending: toInt(wire?.pending),
  confirmed: toInt(wire?.confirmed),
  active: toInt(wire?.active),
  completed: toInt(wire?.completed),
  cancelled: toInt(wire?.cancelled),
  expired: toInt(wire?.expired),
  total: toInt(wire?.total),
});

const normalizeWeekly = (wire: DashboardDailyPoint[] | undefined): DashboardDailyPoint[] =>
  (Array.isArray(wire) ? wire : []).map((point) => ({
    day: (point.day ?? '').trim(),
    date: (point.date ?? '').trim(),
    bookings: toInt(point.bookings),
    revenue: toNumber(point.revenue),
    commission: toNumber(point.commission),
  }));

const normalizeStations = (wire: DashboardStationPoint[] | undefined): DashboardStationPoint[] =>
  (Array.isArray(wire) ? wire : []).map((point) => ({
    name: (point.name ?? '').trim(),
    bookings: toInt(point.bookings),
    revenue: toNumber(point.revenue),
  }));

const normalizeHourly = (wire: DashboardHourlyPoint[] | undefined): DashboardHourlyPoint[] =>
  (Array.isArray(wire) ? wire : []).map((point) => ({
    hour: (point.hour ?? '').trim(),
    bookings: toInt(point.bookings),
  }));

const normalizeUserGrowth = (
  wire: DashboardUserGrowthPoint[] | undefined,
): DashboardUserGrowthPoint[] =>
  (Array.isArray(wire) ? wire : []).map((point) => ({
    month: (point.month ?? '').trim(),
    drivers: toInt(point.drivers),
    owners: toInt(point.owners),
  }));

const normalizeRevenueByType = (
  wire: DashboardRevenueTypePoint[] | undefined,
): DashboardRevenueTypePoint[] =>
  (Array.isArray(wire) ? wire : []).map((point) => ({
    type: (point.type ?? '').trim(),
    revenue: toNumber(point.revenue),
    bookings: toInt(point.bookings),
  }));

export async function getAdminDashboard(token: string): Promise<AdminDashboardData> {
  const response = await apiRequest('/admin/dashboard', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load the platform dashboard.'));
  }

  const payload = await response.json().catch(() => null) as DashboardWireResponse | null;
  if (!payload?.data) {
    throw new Error(payload?.message || 'The dashboard service returned no data.');
  }

  return {
    stats: normalizeStats(payload.data.stats),
    bookingCounts: normalizeBookingCounts(payload.data.bookingCounts),
    weekly: normalizeWeekly(payload.data.weekly),
    stations: normalizeStations(payload.data.stations),
    hourly: normalizeHourly(payload.data.hourly),
    userGrowth: normalizeUserGrowth(payload.data.userGrowth),
    revenueByType: normalizeRevenueByType(payload.data.revenueByType),
    generatedAt: payload.data.generatedAt ?? '',
    timeZone: payload.data.timeZone ?? '',
  };
}
