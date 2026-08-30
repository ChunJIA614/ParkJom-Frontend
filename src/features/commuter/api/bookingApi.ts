import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';

export interface BookingAvailabilityTimeRange {
  from: string;
  to: string;
}

export interface BookingAvailabilityDate {
  date: string;
  timeRanges: BookingAvailabilityTimeRange[];
}

export interface BookingAvailabilityResponse {
  code: number;
  success: boolean;
  message: string;
  parkingSpotId: number;
  month: string;
  timeZone: string;
  minimumBookingDate: string;
  totalAvailableDates: number;
  availableDates: BookingAvailabilityDate[];
}

export interface CreateBookingQuoteRequest {
  startDate: string;
  endDate: string;
}

export interface BookingQuote {
  quoteId: string;
  parkingSpotId: number;
  startDate: string;
  endDate: string;
  bookedDays: number;
  rateType: string;
  ratePerDay: number;
  rentalSubtotal: number;
  expiresAt: string;
}

export interface ConfirmedBooking {
  bookingId: number;
  bookingReference: string;
  quoteId: string;
  parkingSpotId: number;
  vehicleId: number;
  startDate: string;
  endDate: string;
  bookedDays: number;
  bookingStatus: string;
  createdAt: string;
}

export interface BookingQuoteResponse {
  code: number;
  success: boolean;
  message: string;
  data: BookingQuote;
}

export interface ConfirmBookingResponse {
  code: number;
  success: boolean;
  message: string;
  data: ConfirmedBooking;
}

type BookingAvailabilityWireDate = {
  date?: string;
  Date?: string;
  timeRanges?: BookingAvailabilityTimeRange[];
  TimeRanges?: BookingAvailabilityTimeRange[];
};

type BookingAvailabilityWireResponse = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  parkingSpotId?: number;
  ParkingSpotId?: number;
  month?: string;
  Month?: string;
  timeZone?: string;
  TimeZone?: string;
  minimumBookingDate?: string;
  MinimumBookingDate?: string;
  totalAvailableDates?: number;
  TotalAvailableDates?: number;
  availableDates?: BookingAvailabilityWireDate[];
  AvailableDates?: BookingAvailabilityWireDate[];
};

type WireResponse<T> = {
  code?: number;
  Code?: number;
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  data?: T;
  Data?: T;
};

function readEnvelope<T>(payload: WireResponse<T>, status: number) {
  return {
    code: payload.code ?? payload.Code ?? status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    data: payload.data ?? payload.Data,
  };
}

function normalizeBookingAvailabilityDate(
  value: BookingAvailabilityWireDate,
): BookingAvailabilityDate | null {
  const date = value.date ?? value.Date;
  const timeRanges = value.timeRanges ?? value.TimeRanges;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(timeRanges)) return null;

  return {
    date,
    timeRanges: timeRanges.flatMap((range) => {
      if (!range || typeof range !== 'object') return [];
      const from = range.from;
      const to = range.to;
      return typeof from === 'string' && typeof to === 'string' ? [{ from, to }] : [];
    }),
  };
}

export async function getBookingAvailability(
  parkingSpotId: number,
  month: string,
  signal?: AbortSignal,
): Promise<BookingAvailabilityResponse> {
  const query = new URLSearchParams({ month });
  const response = await apiRequest(
    `/public/parking/${encodeURIComponent(String(parkingSpotId))}/booking-availability?${query.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load booking availability.'));
  }

  const payload = await response.json().catch(() => null) as BookingAvailabilityWireResponse | null;
  if (!payload) throw new Error('The booking availability service returned an unreadable response.');

  const wireAvailableDates = payload.availableDates ?? payload.AvailableDates;
  if (!Array.isArray(wireAvailableDates)) {
    throw new Error('The booking availability service returned an unreadable date list.');
  }

  const availableDates = wireAvailableDates
    .flatMap((value) => value ? [normalizeBookingAvailabilityDate(value)] : [])
    .filter((value): value is BookingAvailabilityDate => value !== null);
  const result: BookingAvailabilityResponse = {
    code: payload.code ?? payload.Code ?? response.status,
    success: payload.success ?? payload.Success ?? false,
    message: payload.message ?? payload.Message ?? '',
    parkingSpotId: payload.parkingSpotId ?? payload.ParkingSpotId ?? parkingSpotId,
    month: payload.month ?? payload.Month ?? month,
    timeZone: payload.timeZone ?? payload.TimeZone ?? 'Asia/Kuala_Lumpur',
    minimumBookingDate: payload.minimumBookingDate ?? payload.MinimumBookingDate ?? '',
    totalAvailableDates: payload.totalAvailableDates ?? payload.TotalAvailableDates ?? availableDates.length,
    availableDates,
  };

  if (!result.success) {
    throw new Error(result.message || 'Unable to load booking availability.');
  }

  return result;
}

async function readBookingResponse<T>(
  response: Response,
  fallback: string,
  unreadable: string,
): Promise<{ code: number; success: boolean; message: string; data: T }> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));

  const payload = await response.json().catch(() => null) as WireResponse<T> | null;
  if (!payload) throw new Error(unreadable);

  const result = readEnvelope(payload, response.status);
  if (!result.success) throw new Error(result.message || fallback);
  if (!result.data) throw new Error(unreadable);

  return result as { code: number; success: boolean; message: string; data: T };
}

export async function createBookingQuote(
  token: string,
  parkingSpotId: number,
  dates: CreateBookingQuoteRequest,
): Promise<BookingQuoteResponse> {
  const response = await apiRequest(
    `/public/parking/${encodeURIComponent(String(parkingSpotId))}/booking-quotes`,
    {
      method: 'POST',
      headers: authorizationHeaders(token, 'application/json'),
      body: JSON.stringify(dates),
    },
  );

  return readBookingResponse<BookingQuote>(
    response,
    'Unable to create a booking quote.',
    'The booking service returned an unreadable quote.',
  );
}

export async function confirmBooking(
  token: string,
  quoteId: string,
  vehicleId: number,
  idempotencyKey: string,
): Promise<ConfirmBookingResponse> {
  const response = await apiRequest('/bookings/confirm', {
    method: 'POST',
    headers: {
      ...authorizationHeaders(token, 'application/json'),
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ quoteId, vehicleId }),
  });

  return readBookingResponse<ConfirmedBooking>(
    response,
    'Unable to confirm this booking.',
    'The booking service returned an unreadable confirmation.',
  );
}
