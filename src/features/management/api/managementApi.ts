import type { AuthUser } from '@/features/auth/context/AuthContext';
import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import {
  PROPERTY_MANAGEMENT_USER_TYPE,
  type ManagementAccessEvent,
  type ManagementAccessEventQuery,
  type ManagementAccount,
  type ManagementAccountCreateRequest,
  type ManagementAccountStatus,
  type ManagementAccountUpdateRequest,
  type ManagementBooking,
  type ManagementBookingQuery,
  type ManagementLoginResponse,
  type ManagementProfile,
  type PagedResponse,
  type PlateCheckLog,
  type PlateCheckResult,
} from '../types';

function read<T = unknown>(obj: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!obj) return undefined;
  const pascal = key.charAt(0).toUpperCase() + key.slice(1);
  return (obj[key] ?? obj[pascal]) as T | undefined;
}

function mapProfile(raw: Record<string, unknown> | null | undefined): ManagementProfile {
  return {
    managementAccountId: Number(read(raw, 'managementAccountId') ?? 0),
    email: String(read(raw, 'email') ?? ''),
    username: String(read(raw, 'username') ?? ''),
    mustChangePassword: Boolean(read(raw, 'mustChangePassword')),
    propertyId: Number(read(raw, 'propertyId') ?? 0),
    propertyName: String(read(raw, 'propertyName') ?? ''),
    propertyAddress: String(read(raw, 'propertyAddress') ?? ''),
  };
}

function mapLoginResponse(raw: Record<string, unknown>): ManagementLoginResponse {
  const data = read<Record<string, unknown>>(raw, 'data') ?? {};
  return {
    code: Number(read(raw, 'code') ?? 200),
    success: Boolean(read(raw, 'success') ?? true),
    message: String(read(raw, 'message') ?? ''),
    jwtToken: String(read(raw, 'jwtToken') ?? ''),
    mustChangePassword: Boolean(read(raw, 'mustChangePassword')),
    data: mapProfile(data),
  };
}

/** Turn a management login or invitation activation response into an `AuthUser` session. */
export function managementSessionFromLogin(response: ManagementLoginResponse): AuthUser {
  const { data } = response;
  const [firstName, ...rest] = (data.username || data.email).trim().split(/\s+/);
  return {
    userId: data.managementAccountId,
    email: data.email,
    firstName: firstName || data.username || 'Manager',
    lastName: rest.join(' '),
    picture: '',
    phoneNumber: '',
    userType: PROPERTY_MANAGEMENT_USER_TYPE,
    role: 'PropertyManagement',
    token: response.jwtToken,
    isProfileComplete: !response.mustChangePassword,
    accountStatus: 'Active',
    propertyId: data.propertyId,
    propertyName: data.propertyName,
    propertyAddress: data.propertyAddress,
  };
}

/* ── Authentication & Invitation ── */

export async function loginManagement(email: string, password: string): Promise<ManagementLoginResponse> {
  const response = await apiRequest('/auth/management/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to sign in to property management.'));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const mapped = mapLoginResponse(payload);
  if (!mapped.jwtToken) {
    throw new Error(mapped.message || 'Sign-in did not return an access token.');
  }
  return mapped;
}

export async function activateManagementInvitation(
  invitationToken: string,
  newPassword: string,
): Promise<ManagementLoginResponse> {
  const response = await apiRequest('/management/invitation/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ invitationToken: invitationToken.trim(), newPassword }),
  });

  if (!response.ok) {
    const fallback = response.status === 410
      ? 'This invitation link has expired. Ask your ParkJom administrator to resend it.'
      : response.status === 409
        ? 'This invitation link has already been used or revoked.'
        : 'Unable to activate your management invitation.';
    throw new Error(await readApiError(response, fallback));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const mapped = mapLoginResponse(payload);
  if (!mapped.jwtToken) {
    throw new Error(mapped.message || 'Activation did not return an access token.');
  }
  return mapped;
}

export async function logoutManagement(token: string): Promise<void> {
  await apiRequest('/auth/management/logout', {
    method: 'POST',
    headers: authorizationHeaders(token),
  });
}

/* ── Property Management Operations ── */

function mapBooking(raw: Record<string, unknown>): ManagementBooking {
  return {
    bookingId: Number(read(raw, 'bookingId') ?? 0),
    bookingReference: String(read(raw, 'bookingReference') ?? ''),
    parkingSpotId: Number(read(raw, 'parkingSpotId') ?? 0),
    parkingLabel: (read<string | null>(raw, 'parkingLabel') ?? null),
    vehicleNumberPlate: String(read(raw, 'vehicleNumberPlate') ?? ''),
    bookingStatus: String(read(raw, 'bookingStatus') ?? ''),
    startDate: String(read(raw, 'startDate') ?? ''),
    endDate: String(read(raw, 'endDate') ?? ''),
    checkedInAt: (read<string | null>(raw, 'checkedInAt') ?? null),
    actualExitAt: (read<string | null>(raw, 'actualExitAt') ?? null),
  };
}

export async function getManagementBookings(
  token: string,
  query: ManagementBookingQuery = {},
  signal?: AbortSignal,
): Promise<PagedResponse<ManagementBooking>> {
  const params = new URLSearchParams();
  if (query.parkingSpotId && query.parkingSpotId > 0) params.set('parkingSpotId', String(query.parkingSpotId));
  if (query.status) params.set('status', query.status);
  if (query.fromDate) params.set('fromDate', `${query.fromDate}T00:00:00`);
  if (query.toDate) params.set('toDate', `${query.toDate}T23:59:59`);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 25));

  const response = await apiRequest(`/management/booking?${params.toString()}`, {
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load property bookings.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const rows = (read<Record<string, unknown>[]>(raw, 'data') ?? []).map(mapBooking);
  return {
    code: Number(read(raw, 'code') ?? 200),
    success: Boolean(read(raw, 'success') ?? true),
    message: String(read(raw, 'message') ?? ''),
    totalCount: Number(read(raw, 'totalCount') ?? rows.length),
    page: Number(read(raw, 'page') ?? 1),
    pageSize: Number(read(raw, 'pageSize') ?? 25),
    data: rows,
  };
}

export async function getManagementBookingById(
  token: string,
  bookingId: number,
  signal?: AbortSignal,
): Promise<ManagementBooking> {
  const response = await apiRequest(`/management/booking/${bookingId}`, {
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Unable to load booking #${bookingId}.`));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return mapBooking(raw);
}

export async function getManagementAccessEvents(
  token: string,
  query: ManagementAccessEventQuery = {},
  signal?: AbortSignal,
): Promise<PagedResponse<ManagementAccessEvent>> {
  const params = new URLSearchParams();
  if (query.fromDate) params.set('from', `${query.fromDate}T00:00:00+08:00`);
  if (query.toDate) params.set('to', `${query.toDate}T23:59:59+08:00`);
  if (query.parkingSpotId && query.parkingSpotId > 0) params.set('parkingSpotId', String(query.parkingSpotId));
  if (query.plate?.trim()) params.set('plate', query.plate.trim());
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 50));

  const response = await apiRequest(`/management/access-events?${params.toString()}`, {
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load gate entry events.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const rows = (read<Record<string, unknown>[]>(raw, 'data') ?? []).map((item): ManagementAccessEvent => ({
    ioTStatusLogId: Number(read(item, 'ioTStatusLogId') ?? read(item, 'iotStatusLogId') ?? 0),
    bookingId: Number(read(item, 'bookingId') ?? 0),
    parkingSpotId: Number(read(item, 'parkingSpotId') ?? 0),
    parkingLabel: (read<string | null>(item, 'parkingLabel') ?? null),
    vehicleNumberPlate: String(read(item, 'vehicleNumberPlate') ?? ''),
    enteredAtUtc: String(read(item, 'enteredAtUtc') ?? ''),
    firstEntryForBooking: Boolean(read(item, 'firstEntryForBooking')),
  }));

  return {
    code: Number(read(raw, 'code') ?? 200),
    success: Boolean(read(raw, 'success') ?? true),
    message: String(read(raw, 'message') ?? ''),
    totalCount: Number(read(raw, 'totalCount') ?? rows.length),
    page: Number(read(raw, 'page') ?? 1),
    pageSize: Number(read(raw, 'pageSize') ?? 50),
    data: rows,
  };
}

export async function checkVehiclePlate(
  token: string,
  input: { imageBase64: string; mimeType?: string; parkingSpotId?: number | null },
): Promise<PlateCheckResult> {
  const body: Record<string, unknown> = {
    imageBase64: input.imageBase64,
    mimeType: input.mimeType || 'image/jpeg',
  };
  if (input.parkingSpotId && input.parkingSpotId > 0) {
    body.parkingSpotId = input.parkingSpotId;
  }

  const response = await apiRequest('/management/plate-check', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to check vehicle plate.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const data = read<Record<string, unknown>>(raw, 'data') ?? {};
  return {
    allowed: Boolean(read(data, 'allowed')),
    decisionCode: String(read(data, 'decisionCode') ?? ''),
    propertyId: Number(read(data, 'propertyId') ?? 0),
    bookingId: read<number | null>(data, 'bookingId') ?? null,
    parkingSpotId: read<number | null>(data, 'parkingSpotId') ?? null,
    detectedPlate: String(read(data, 'detectedPlate') ?? ''),
    formattedPlate: String(read(data, 'formattedPlate') ?? read(data, 'detectedPlate') ?? ''),
    confidence: Number(read(data, 'confidence') ?? 0),
    minimumConfidence: Number(read(data, 'minimumConfidence') ?? 0.8),
    message: String(read(raw, 'message') ?? ''),
  };
}

export async function getPlateCheckHistory(
  token: string,
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<PagedResponse<PlateCheckLog>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await apiRequest(`/management/plate-check?${params.toString()}`, {
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load plate-check history.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const rows = (read<Record<string, unknown>[]>(raw, 'data') ?? []).map((item): PlateCheckLog => ({
    accessLogId: Number(read(item, 'accessLogId') ?? 0),
    checkedAtUtc: String(read(item, 'checkedAtUtc') ?? ''),
    outcome: String(read(item, 'outcome') ?? 'denied'),
    details: String(read(item, 'details') ?? ''),
    bookingId: read<number | null>(item, 'bookingId') ?? null,
  }));

  return {
    code: Number(read(raw, 'code') ?? 200),
    success: Boolean(read(raw, 'success') ?? true),
    message: String(read(raw, 'message') ?? ''),
    totalCount: Number(read(raw, 'totalCount') ?? rows.length),
    page: Number(read(raw, 'page') ?? page),
    pageSize: Number(read(raw, 'pageSize') ?? pageSize),
    data: rows,
  };
}

/** Parse key=value tokens written by `PropertyManagementController.CheckPlate` into the audit detail string. */
export function parsePlateCheckDetails(details: string): {
  plate: string;
  decision: string;
  confidence: number | null;
  spotId: number | null;
} {
  const fields: Record<string, string> = {};
  for (const part of details.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const key = part.slice(0, eq).trim().split(/\s+/).pop() ?? '';
      const val = part.slice(eq + 1).trim();
      if (key) fields[key.toLowerCase()] = val;
    }
  }
  const conf = fields.confidence ? Number(fields.confidence) : NaN;
  const spot = fields.spotid ? Number(fields.spotid) : NaN;
  return {
    plate: fields.plate || '—',
    decision: fields.decision || '—',
    confidence: Number.isFinite(conf) ? conf : null,
    spotId: Number.isFinite(spot) && spot > 0 ? spot : null,
  };
}

/* ── Admin Management Accounts (`AdminPropertyManagementAccountsController`) ── */

function mapManagementAccount(raw: Record<string, unknown>): ManagementAccount {
  return {
    managementAccountId: Number(read(raw, 'managementAccountId') ?? 0),
    email: String(read(raw, 'email') ?? ''),
    username: String(read(raw, 'username') ?? ''),
    propertyId: Number(read(raw, 'propertyId') ?? 0),
    propertyName: String(read(raw, 'propertyName') ?? ''),
    accountStatus: String(read(raw, 'accountStatus') ?? 'Active'),
    mustChangePassword: Boolean(read(raw, 'mustChangePassword')),
    createdAt: String(read(raw, 'createdAt') ?? ''),
    lastLoginAt: (read<string | null>(raw, 'lastLoginAt') ?? null),
    invitationEmailStatus: (read<string | null>(raw, 'invitationEmailStatus') ?? null),
    invitationLink: (read<string | null>(raw, 'invitationLink') ?? null),
    smtpErrorMessage: (read<string | null>(raw, 'smtpErrorMessage') ?? null),
  };
}

export async function listManagementAccounts(
  token: string,
  query: { propertyId?: number; status?: ManagementAccountStatus | ''; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<PagedResponse<ManagementAccount>> {
  const params = new URLSearchParams();
  if (query.propertyId && query.propertyId > 0) params.set('propertyId', String(query.propertyId));
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));

  const response = await apiRequest(`/admin/management/account?${params.toString()}`, {
    headers: authorizationHeaders(token),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to load property management accounts.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const rows = (read<Record<string, unknown>[]>(raw, 'data') ?? []).map(mapManagementAccount);
  return {
    code: Number(read(raw, 'code') ?? 200),
    success: Boolean(read(raw, 'success') ?? true),
    message: String(read(raw, 'message') ?? ''),
    totalCount: Number(read(raw, 'totalCount') ?? rows.length),
    page: Number(read(raw, 'page') ?? 1),
    pageSize: Number(read(raw, 'pageSize') ?? 20),
    data: rows,
  };
}

export async function createManagementAccount(
  token: string,
  request: ManagementAccountCreateRequest,
): Promise<ManagementAccount> {
  const response = await apiRequest('/admin/management/account', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to create property management account.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return mapManagementAccount(raw);
}

export async function updateManagementAccount(
  token: string,
  managementAccountId: number,
  request: ManagementAccountUpdateRequest,
): Promise<ManagementAccount> {
  const response = await apiRequest(`/admin/management/account/${managementAccountId}`, {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to update property management account.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return mapManagementAccount(raw);
}

export async function getManagementInvitationLink(
  token: string,
  managementAccountId: number,
): Promise<{ invitationLink: string; expiresAtUtc: string }> {
  const response = await apiRequest(`/admin/management/account/${managementAccountId}/invitation-link`, {
    headers: authorizationHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to generate invitation link.'));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return {
    invitationLink: String(read(raw, 'invitationLink') ?? ''),
    expiresAtUtc: String(read(raw, 'expiresAtUtc') ?? ''),
  };
}
