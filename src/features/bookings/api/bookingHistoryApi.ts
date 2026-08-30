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
  data: BookingHistoryItem[];
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

async function getBookingHistory(
  path: string,
  token: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<BookingHistoryResponse> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
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

  const result: BookingHistoryResponse = {
    code: Number(readField(payload, 'code', 'Code') ?? response.status),
    success: Boolean(readField(payload, 'success', 'Success')),
    message: String(readField(payload, 'message', 'Message') ?? ''),
    totalCount: Number(readField(payload, 'totalCount', 'TotalCount') ?? data.length),
    page: Number(readField(payload, 'page', 'Page') ?? page),
    pageSize: Number(readField(payload, 'pageSize', 'PageSize') ?? pageSize),
    totalPages: Number(readField(payload, 'totalPages', 'TotalPages') ?? (data.length > 0 ? 1 : 0)),
    data,
  };

  if (!result.success) throw new Error(result.message || 'Unable to load booking history.');
  return result;
}

export function getCommuterBookingHistory(
  token: string,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
) {
  return getBookingHistory('/bookings/history', token, page, pageSize, signal);
}

export function getOwnerBookingHistory(
  token: string,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
) {
  return getBookingHistory('/parking/bookings/history', token, page, pageSize, signal);
}
