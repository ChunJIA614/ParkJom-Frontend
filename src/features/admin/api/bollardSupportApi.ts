import { apiRequest, authorizationHeaders } from '@/services/apiClient';
import type { Timestamp } from '@/lib/dateTime';

export const bollardSearchModes = [
  { value: 'bookingReference', label: 'Booking reference', placeholder: 'e.g. PJ-EXAMPLE-0042', kind: 'reference' },
  { value: 'renterName', label: 'Renter name', placeholder: 'e.g. Aisha', kind: 'name' },
  { value: 'ownerName', label: 'Owner name', placeholder: 'e.g. Tan', kind: 'name' },
  { value: 'propertyName', label: 'Property name', placeholder: 'e.g. Vista', kind: 'name' },
  { value: 'deviceUuid', label: 'Device UUID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', kind: 'uuid' },
  { value: 'bookingId', label: 'Booking ID', placeholder: 'e.g. 42', kind: 'id' },
  { value: 'parkingSpotId', label: 'Parking spot ID', placeholder: 'e.g. 24', kind: 'id' },
  { value: 'renterId', label: 'Renter ID', placeholder: 'e.g. 7', kind: 'id' },
  { value: 'ownerId', label: 'Owner ID', placeholder: 'e.g. 9', kind: 'id' },
  { value: 'propertyId', label: 'Property ID', placeholder: 'e.g. 3', kind: 'id' },
  { value: 'deviceId', label: 'Device database ID', placeholder: 'e.g. 8', kind: 'id' },
] as const;

export type BollardSearchMode = typeof bollardSearchModes[number]['value'];
export type BollardSearch = { by: BollardSearchMode; q: string; page: number; pageSize: number };

interface Person { userId: number; name: string }
export interface SupportBollard {
  ioTDeviceId: number;
  deviceUuid: string;
  deviceStatus: string;
  firmwareVersion: string | null;
  lastHeartbeatAt: Timestamp;
  isAssigned: boolean;
  canControl: boolean;
  parkingSpot: {
    parkingSpotId: number;
    parkingLabel: string | null;
    availabilityStatus: string;
    isPublished: boolean;
    owner: Person;
    property: { propertyId: number; propertyName: string; address: string };
  } | null;
  booking: {
    bookingId: number;
    bookingReference: string;
    bookingStatus: string;
    startDate: string;
    endDate: string;
    checkedInAt: Timestamp;
    actualExitAt: Timestamp;
    renter: Person;
  } | null;
}

export interface BollardSearchPage {
  items: SupportBollard[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function validateBollardSearch(by: BollardSearchMode, input: string) {
  const q = input.trim();
  const mode = bollardSearchModes.find(option => option.value === by);
  if (!q) return 'Enter a search value.';
  if (q.length > 120) return 'Use no more than 120 characters.';
  if (mode?.kind === 'name' && q.length < 2) return 'Enter at least two characters.';
  if (mode?.kind === 'id' && (!/^\d+$/.test(q) || Number(q) < 1 || Number(q) > 2147483647)) {
    return 'Enter a positive whole number up to 2,147,483,647.';
  }
  if (mode?.kind === 'uuid' && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(q)) {
    return 'Enter a device UUID with hyphens.';
  }
  return null;
}

export async function searchSupportBollards(token: string, search: BollardSearch, signal: AbortSignal) {
  const query = new URLSearchParams({
    by: search.by, q: search.q.trim(), page: String(search.page), pageSize: String(search.pageSize),
  });
  const response = await apiRequest('/admin/iot/devices/search?' + query, {
    headers: authorizationHeaders(token), signal, cache: 'no-store',
  }, { preserveSessionOnForbidden: true });
  const body = await response.json().catch(() => null) as {
    success?: boolean; data?: BollardSearchPage; message?: string; errors?: Record<string, string[]>;
  } | null;
  if (!response.ok) {
    if (response.status === 403) throw new Error('Administrator access is required to search for bollards.');
    if (response.status === 401) throw new Error('Your session expired. Sign in again to continue.');
    const detail = Object.values(body?.errors ?? {}).flat().find(message => typeof message === 'string');
    throw new Error(detail || body?.message || 'Could not search for bollards. Try again.');
  }
  if (!body?.success || !Array.isArray(body.data?.items)) throw new Error('The search response was incomplete. Try again.');
  return body.data;
}
