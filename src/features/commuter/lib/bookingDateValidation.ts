import type { BookingAvailabilityResponse, BookingQuote } from '../api/bookingApi';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;
const MAX_SPANNED_MONTHS = 12;

export interface BookingDateRangeValidation {
  isValid: boolean;
  isLoadingMonths: boolean;
  missingMonths: string[];
  totalDays: number;
  openDates: string[];
  unavailableDates: string[];
  error: string | null;
}

export function isValidIsoDateKey(dateKey: string): boolean {
  if (typeof dateKey !== 'string' || !ISO_DATE_REGEX.test(dateKey)) return false;
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  );
}

export function dateFromIsoKey(dateKey: string): Date {
  if (!isValidIsoDateKey(dateKey)) return new Date(NaN);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIsoDateShort(dateKey: string): string {
  if (!isValidIsoDateKey(dateKey)) return dateKey;
  return dateFromIsoKey(dateKey).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getDatesBetween(fromDate: string, toDate: string): string[] {
  if (!isValidIsoDateKey(fromDate) || !isValidIsoDateKey(toDate) || toDate < fromDate) return [];
  const dates: string[] = [];
  const cursor = dateFromIsoKey(fromDate);
  const lastDate = dateFromIsoKey(toDate);
  while (cursor <= lastDate && dates.length < MAX_RANGE_DAYS) {
    dates.push(toIsoDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function getMonthsBetween(fromDate: string, toDate: string): string[] {
  if (!isValidIsoDateKey(fromDate) || !isValidIsoDateKey(toDate) || toDate < fromDate) return [];
  const [startYear, startMonth] = fromDate.split('-').map(Number);
  const [endYear, endMonth] = toDate.split('-').map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < MAX_SPANNED_MONTHS) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function isDateAvailableInMap(
  dateKey: string,
  availabilityByMonth: Record<string, BookingAvailabilityResponse>,
  minimumBookingDate: string,
): boolean {
  if (!isValidIsoDateKey(dateKey)) return false;
  if (minimumBookingDate && dateKey < minimumBookingDate) return false;
  const monthAvailability = availabilityByMonth[dateKey.slice(0, 7)];
  if (!monthAvailability) return false;
  return monthAvailability.availableDates.some((availableDate) => availableDate.date === dateKey);
}

export function findNearestAvailableDate(
  availabilityByMonth: Record<string, BookingAvailabilityResponse>,
  fromDate: string,
  minimumBookingDate: string,
): string | null {
  const candidates = new Set<string>();
  for (const monthAvailability of Object.values(availabilityByMonth)) {
    for (const item of monthAvailability.availableDates) {
      if (isValidIsoDateKey(item.date) && (!minimumBookingDate || item.date >= minimumBookingDate)) {
        candidates.add(item.date);
      }
    }
  }
  if (candidates.size === 0) return null;

  const sorted = [...candidates].sort();
  const threshold = isValidIsoDateKey(fromDate)
    ? (minimumBookingDate && fromDate < minimumBookingDate ? minimumBookingDate : fromDate)
    : minimumBookingDate;

  return sorted.find((dateKey) => !threshold || dateKey >= threshold) ?? sorted[0] ?? null;
}

export function validateBookingDateRange({
  startDate,
  endDate,
  availabilityByMonth,
  minimumBookingDate,
}: {
  startDate: string;
  endDate: string;
  availabilityByMonth: Record<string, BookingAvailabilityResponse>;
  minimumBookingDate: string;
}): BookingDateRangeValidation {
  if (!startDate || !endDate) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: 0,
      openDates: [],
      unavailableDates: [],
      error: null,
    };
  }

  if (!isValidIsoDateKey(startDate) || !isValidIsoDateKey(endDate)) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: 0,
      openDates: [],
      unavailableDates: [],
      error: 'Choose valid check-in and check-out dates.',
    };
  }

  if (endDate < startDate) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: 0,
      openDates: [],
      unavailableDates: [],
      error: 'Choose an end date on or after the start date.',
    };
  }

  if (minimumBookingDate && startDate < minimumBookingDate) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: 0,
      openDates: [],
      unavailableDates: [],
      error: `Bookings open from ${formatIsoDateShort(minimumBookingDate)}.`,
    };
  }

  const dates = getDatesBetween(startDate, endDate);
  if (dates.length === 0) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: 0,
      openDates: [],
      unavailableDates: [],
      error: 'Choose valid check-in and check-out dates.',
    };
  }

  const spannedMonths = getMonthsBetween(startDate, endDate);
  const missingMonths = spannedMonths.filter((month) => !availabilityByMonth[month]);
  if (missingMonths.length > 0) {
    return {
      isValid: false,
      isLoadingMonths: true,
      missingMonths,
      totalDays: dates.length,
      openDates: [],
      unavailableDates: [],
      error: null,
    };
  }

  const openDates: string[] = [];
  const unavailableDates: string[] = [];
  for (const dateKey of dates) {
    if (isDateAvailableInMap(dateKey, availabilityByMonth, minimumBookingDate)) {
      openDates.push(dateKey);
    } else {
      unavailableDates.push(dateKey);
    }
  }

  if (openDates.length === 0) {
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: dates.length,
      openDates,
      unavailableDates,
      error: dates.length === 1
        ? `${formatIsoDateShort(startDate)} is not available for booking. Please select an available date.`
        : 'No available booking dates exist within the selected range.',
    };
  }

  if (unavailableDates.length > 0) {
    const formatted = unavailableDates.slice(0, 3).map(formatIsoDateShort).join(', ');
    const suffix = unavailableDates.length > 3 ? ` + ${unavailableDates.length - 3} more` : '';
    return {
      isValid: false,
      isLoadingMonths: false,
      missingMonths: [],
      totalDays: dates.length,
      openDates,
      unavailableDates,
      error: `Selected range includes unavailable date${unavailableDates.length === 1 ? '' : 's'} (${formatted}${suffix}). Please select consecutive available dates only.`,
    };
  }

  return {
    isValid: true,
    isLoadingMonths: false,
    missingMonths: [],
    totalDays: dates.length,
    openDates,
    unavailableDates: [],
    error: null,
  };
}

export function validateQuoteMatchesSelection(
  quote: BookingQuote,
  startDate: string,
  endDate: string,
  expectedOpenDays: number,
): string | null {
  if (quote.startDate !== startDate || quote.endDate !== endDate) {
    return 'The booking quote dates do not match your selected dates. Please request a new quote.';
  }
  if (quote.bookedDays !== expectedOpenDays) {
    return `The server returned a quote for ${quote.bookedDays} day${quote.bookedDays === 1 ? '' : 's'}, which does not match your ${expectedOpenDays} available selected day${expectedOpenDays === 1 ? '' : 's'}. Availability may have just changed — please review the calendar.`;
  }
  const expiresMs = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    return 'This booking quote has expired. Please request a fresh quote.';
  }
  return null;
}
