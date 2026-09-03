import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface BookingHistoryBooking {
  bookingId: number;
  bookingReference: string;
  renterId: number;
  parkingSpotId: number;
  parkingLabel: string;
  vehicleId: number;
  startDate: string;
  endDate: string;
  bookingStatus: string;
  totalAmount: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface BookingHistoryReview {
  reviewId: number;
  parkingSpotId: number;
  rating: number;
  comment: string;
  reviewerDisplayName: string;
  isVerifiedBooking: boolean;
  ownerReply: string | null;
  ownerReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface BookingHistoryFilters {
  fromDate?: string;
  toDate?: string;
  status?: string;
}

export interface BookingHistoryItem {
  booking: BookingHistoryBooking;
  canReview: boolean;
  review: BookingHistoryReview | null;
}

export interface BookingHistoryResponse {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  status: string | null;
  fromDate: string | null;
  toDate: string | null;
  data: BookingHistoryItem[];
}

export interface OwnerBookingHistoryItem {
  bookingId: number;
  bookingReference: string;
  parkingSpotId: number;
  parkingLabel: string;
  renterId: number;
  renterName: string;
  renterEmail: string;
  renterPhoneNumber: string;
  vehicleId: number;
  vehicleNumberPlate: string;
  startDate: string;
  endDate: string;
  bookedDays: number;
  bookingStatus: string;
  renterTotal: number;
  ownerPayoutAmount: number;
  createdAt: string;
}

export interface OwnerBookingHistoryResponse {
  code: number;
  success: boolean;
  message: string;
  parkingSpotId: number | null;
  month: string | null;
  status: string | null;
  timeZone: string;
  totalCount: number;
  data: OwnerBookingHistoryItem[];
}

type WireObject = Record<string, unknown>;

const asObject = (value: unknown): WireObject | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as WireObject
    : null
);

const readField = (data: WireObject, camel: string, pascal: string) => data[camel] ?? data[pascal];

function normalizeBooking(value: unknown): BookingHistoryBooking | null {
  const data = asObject(value);
  if (!data) return null;

  const bookingId = readField(data, 'bookingId', 'BookingId');
  const renterId = readField(data, 'renterId', 'RenterId');
  const parkingSpotId = readField(data, 'parkingSpotId', 'ParkingSpotId');
  const vehicleId = readField(data, 'vehicleId', 'VehicleId');
  const totalAmount = readField(data, 'totalAmount', 'TotalAmount');
  if (
    typeof bookingId !== 'number'
    || typeof renterId !== 'number'
    || typeof parkingSpotId !== 'number'
    || typeof vehicleId !== 'number'
    || typeof totalAmount !== 'number'
  ) return null;

  return {
    bookingId,
    bookingReference: String(readField(data, 'bookingReference', 'BookingReference') ?? ''),
    renterId,
    parkingSpotId,
    parkingLabel: String(readField(data, 'parkingLabel', 'ParkingLabel') ?? ''),
    vehicleId,
    startDate: String(readField(data, 'startDate', 'StartDate') ?? ''),
    endDate: String(readField(data, 'endDate', 'EndDate') ?? ''),
    bookingStatus: String(readField(data, 'bookingStatus', 'BookingStatus') ?? ''),
    totalAmount,
    cancellationReason: readField(data, 'cancellationReason', 'CancellationReason') as string | null ?? null,
    cancelledAt: readField(data, 'cancelledAt', 'CancelledAt') as string | null ?? null,
    createdAt: String(readField(data, 'createdAt', 'CreatedAt') ?? ''),
  };
}

function normalizeReview(value: unknown): BookingHistoryReview | null {
  const data = asObject(value);
  if (!data) return null;

  const reviewId = readField(data, 'reviewId', 'ReviewId');
  const parkingSpotId = readField(data, 'parkingSpotId', 'ParkingSpotId');
  const rating = readField(data, 'rating', 'Rating');
  const isVerifiedBooking = readField(data, 'isVerifiedBooking', 'IsVerifiedBooking');
  if (
    typeof reviewId !== 'number'
    || typeof parkingSpotId !== 'number'
    || typeof rating !== 'number'
    || typeof isVerifiedBooking !== 'boolean'
  ) return null;

  return {
    reviewId,
    parkingSpotId,
    rating,
    comment: String(readField(data, 'comment', 'Comment') ?? ''),
    reviewerDisplayName: String(readField(data, 'reviewerDisplayName', 'ReviewerDisplayName') ?? ''),
    isVerifiedBooking,
    ownerReply: readField(data, 'ownerReply', 'OwnerReply') as string | null ?? null,
    ownerReplyAt: readField(data, 'ownerReplyAt', 'OwnerReplyAt') as string | null ?? null,
    createdAt: String(readField(data, 'createdAt', 'CreatedAt') ?? ''),
    updatedAt: String(readField(data, 'updatedAt', 'UpdatedAt') ?? ''),
  };
}

function normalizeItem(value: unknown): BookingHistoryItem | null {
  const data = asObject(value);
  if (!data) return null;

  const booking = normalizeBooking(readField(data, 'booking', 'Booking'));
  const canReview = readField(data, 'canReview', 'CanReview');
  const reviewValue = readField(data, 'review', 'Review');
  const review = reviewValue === null || reviewValue === undefined ? null : normalizeReview(reviewValue);
  if (!booking || typeof canReview !== 'boolean' || (reviewValue != null && !review)) return null;

  return { booking, canReview, review };
}

function normalizeOwnerBooking(value: unknown): OwnerBookingHistoryItem | null {
  const data = asObject(value);
  if (!data) return null;

  const bookingId = readField(data, 'bookingId', 'BookingId');
  const parkingSpotId = readField(data, 'parkingSpotId', 'ParkingSpotId');
  const renterId = readField(data, 'renterId', 'RenterId');
  const vehicleId = readField(data, 'vehicleId', 'VehicleId');
  const bookedDays = readField(data, 'bookedDays', 'BookedDays');
  const renterTotal = readField(data, 'renterTotal', 'RenterTotal');
  const ownerPayoutAmount = readField(data, 'ownerPayoutAmount', 'OwnerPayoutAmount');

  if (
    typeof bookingId !== 'number'
    || typeof parkingSpotId !== 'number'
    || typeof renterId !== 'number'
    || typeof vehicleId !== 'number'
    || typeof bookedDays !== 'number'
    || typeof renterTotal !== 'number'
    || typeof ownerPayoutAmount !== 'number'
  ) return null;

  return {
    bookingId,
    bookingReference: String(readField(data, 'bookingReference', 'BookingReference') ?? ''),
    parkingSpotId,
    parkingLabel: String(readField(data, 'parkingLabel', 'ParkingLabel') ?? ''),
    renterId,
    renterName: String(readField(data, 'renterName', 'RenterName') ?? ''),
    renterEmail: String(readField(data, 'renterEmail', 'RenterEmail') ?? ''),
    renterPhoneNumber: String(readField(data, 'renterPhoneNumber', 'RenterPhoneNumber') ?? ''),
    vehicleId,
    vehicleNumberPlate: String(readField(data, 'vehicleNumberPlate', 'VehicleNumberPlate') ?? ''),
    startDate: String(readField(data, 'startDate', 'StartDate') ?? ''),
    endDate: String(readField(data, 'endDate', 'EndDate') ?? ''),
    bookedDays,
    bookingStatus: String(readField(data, 'bookingStatus', 'BookingStatus') ?? ''),
    renterTotal,
    ownerPayoutAmount,
    createdAt: String(readField(data, 'createdAt', 'CreatedAt') ?? ''),
  };
}

async function getBookingHistory(
  path: string,
  token: string,
  page: number,
  pageSize: number,
  filters: BookingHistoryFilters = {},
  signal?: AbortSignal,
): Promise<BookingHistoryResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.fromDate) query.set('fromDate', filters.fromDate);
  if (filters.toDate) query.set('toDate', filters.toDate);
  if (filters.status) query.set('status', filters.status);
  const response = await apiRequest(`${path}?${query.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load booking history.'));
  }

  const payload = await response.json().catch(() => null) as WireObject | null;
  const wireData = payload ? readField(payload, 'data', 'Data') : null;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The booking service returned an unreadable history response.');
  }

  const data = wireData.map(normalizeItem).filter((item): item is BookingHistoryItem => Boolean(item));
  if (data.length !== wireData.length) {
    throw new Error('The booking service returned incomplete booking history details.');
  }

  const statusValue = readField(payload, 'status', 'Status');
  const fromDateValue = readField(payload, 'fromDate', 'FromDate');
  const toDateValue = readField(payload, 'toDate', 'ToDate');
  const result: BookingHistoryResponse = {
    code: Number(readField(payload, 'code', 'Code') ?? response.status),
    success: Boolean(readField(payload, 'success', 'Success')),
    message: String(readField(payload, 'message', 'Message') ?? ''),
    totalCount: Number(readField(payload, 'totalCount', 'TotalCount') ?? data.length),
    page: Number(readField(payload, 'page', 'Page') ?? page),
    pageSize: Number(readField(payload, 'pageSize', 'PageSize') ?? pageSize),
    totalPages: Number(readField(payload, 'totalPages', 'TotalPages') ?? (data.length > 0 ? 1 : 0)),
    status: statusValue == null ? null : String(statusValue),
    fromDate: fromDateValue == null ? null : String(fromDateValue),
    toDate: toDateValue == null ? null : String(toDateValue),
    data,
  };

  if (!result.success) throw new Error(result.message || 'Unable to load booking history.');
  return result;
}

export function getCommuterBookingHistory(
  token: string,
  page = 1,
  pageSize = 10,
  filters: BookingHistoryFilters = {},
  signal?: AbortSignal,
) {
  return getBookingHistory('commuter/bookings/my-bookings', token, page, pageSize, filters, signal);
}

export async function getOwnerBookingHistory(
  token: string,
  signal?: AbortSignal,
): Promise<OwnerBookingHistoryResponse> {
  const response = await apiRequest('/parking/bookings/history', {
    method: 'GET',
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load owner booking history.'));
  }

  const payload = await response.json().catch(() => null) as WireObject | null;
  const wireData = payload ? readField(payload, 'data', 'Data') : null;
  if (!payload || !Array.isArray(wireData)) {
    throw new Error('The booking service returned an unreadable owner history response.');
  }

  const data = wireData
    .map(normalizeOwnerBooking)
    .filter((booking): booking is OwnerBookingHistoryItem => Boolean(booking));
  if (data.length !== wireData.length) {
    throw new Error('The booking service returned incomplete owner booking details.');
  }

  const parkingSpotIdValue = readField(payload, 'parkingSpotId', 'ParkingSpotId');
  const monthValue = readField(payload, 'month', 'Month');
  const statusValue = readField(payload, 'status', 'Status');
  const result: OwnerBookingHistoryResponse = {
    code: Number(readField(payload, 'code', 'Code') ?? response.status),
    success: Boolean(readField(payload, 'success', 'Success')),
    message: String(readField(payload, 'message', 'Message') ?? ''),
    parkingSpotId: typeof parkingSpotIdValue === 'number' ? parkingSpotIdValue : null,
    month: monthValue == null ? null : String(monthValue),
    status: statusValue == null ? null : String(statusValue),
    timeZone: String(readField(payload, 'timeZone', 'TimeZone') ?? 'Asia/Kuala_Lumpur'),
    totalCount: Number(readField(payload, 'totalCount', 'TotalCount') ?? data.length),
    data,
  };

  if (!result.success) throw new Error(result.message || 'Unable to load owner booking history.');
  return result;
}
