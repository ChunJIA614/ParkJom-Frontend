import { apiRequest, authorizationHeaders, readApiError } from '@/services/apiClient';
import {
  PROFILE_PICTURE_EXTENSIONS,
  PROFILE_PICTURE_MAX_BYTES,
  type AdminUpdateUserProfileRequest,
  type AdminUserDetail,
  type AdminUserListQuery,
  type AdminUserListResult,
  type AdminUserParkingSpot,
  type AdminUserVehicle,
  type BackendUserType,
  type DeactivateAccountRequest,
  type UpdateUserProfileRequest,
  type UserProfile,
  type UserProfileResult,
} from '../types';

type Wire = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Normalisation helpers — ASP.NET may serialise in camelCase or PascalCase.
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Wire =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read the first defined value for any of the given keys (case-insensitive). */
function read(source: unknown, ...keys: string[]): unknown {
  if (!isRecord(source)) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
    const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match && source[match] !== undefined && source[match] !== null) return source[match];
  }
  return undefined;
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value));
const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const bool = (value: unknown) => value === true || String(value).toLowerCase() === 'true';
const optStr = (value: unknown) => (value === undefined || value === null || value === '' ? undefined : String(value));

const USER_TYPE_NAMES: Record<string, BackendUserType> = {
  admin: 1,
  propertyowner: 2,
  owner: 2,
  renter: 3,
  commuter: 3,
};

function toUserType(value: unknown): BackendUserType {
  const numeric = Number(value);
  if (numeric === 1 || numeric === 2 || numeric === 3) return numeric;
  return USER_TYPE_NAMES[str(value).replace(/\s+/g, '').toLowerCase()] ?? 3;
}

function normalizeProfile(raw: unknown): UserProfile {
  // Some envelopes nest the identity under `profile` / `user`.
  const base = read(raw, 'profile', 'user') ?? raw;
  const summarySource = read(base, 'summary', 'activitySummary', 'stats') ?? read(raw, 'summary') ?? base;
  const firstName = str(read(base, 'firstName'));
  const lastName = str(read(base, 'lastName'));

  return {
    userId: num(read(base, 'userId', 'id')),
    email: str(read(base, 'email')),
    firstName,
    lastName,
    fullName: str(read(base, 'fullName')) || `${firstName} ${lastName}`.trim(),
    phoneNumber: str(read(base, 'phoneNumber')),
    profilePictureURL: str(read(base, 'profilePictureURL', 'profilePictureUrl')),
    userType: toUserType(read(base, 'userType')),
    roleName: str(read(base, 'roleName')),
    isProfileComplete: bool(read(base, 'isProfileComplete')),
    accountStatus: str(read(base, 'accountStatus')) || 'Active',
    createdAt: optStr(read(base, 'createdAt')),
    updatedAt: optStr(read(base, 'updatedAt')),
    lastLoginAt: optStr(read(base, 'lastLoginAt', 'lastLogin')),
    summary: {
      walletBalance: num(read(summarySource, 'walletBalance', 'balance')),
      walletOnHold: num(read(summarySource, 'walletOnHold', 'onHold')),
      vehicleCount: num(read(summarySource, 'vehicleCount')),
      activeBookingsCount: num(read(summarySource, 'activeBookingsCount')),
      totalBookingsCount: num(read(summarySource, 'totalBookingsCount')),
      favoritesCount: num(read(summarySource, 'favoritesCount')),
      ownedParkingSpotsCount: num(read(summarySource, 'ownedParkingSpotsCount')),
      openSupportTicketsCount: num(read(summarySource, 'openSupportTicketsCount')),
    },
  };
}

function normalizeVehicle(raw: unknown): AdminUserVehicle {
  return {
    vehicleId: num(read(raw, 'vehicleId', 'id')),
    numberPlate: str(read(raw, 'numberPlate', 'plateNumber', 'licensePlate')),
    vehicleBrand: optStr(read(raw, 'vehicleBrand', 'brand')),
    vehicleModel: optStr(read(raw, 'vehicleModel', 'model')),
    vehicleColor: optStr(read(raw, 'vehicleColor', 'color')),
  };
}

function normalizeSpot(raw: unknown): AdminUserParkingSpot {
  return {
    parkingSpotId: num(read(raw, 'parkingSpotId', 'id')),
    name: str(read(raw, 'title', 'name', 'spotName', 'address')) || 'Parking spot',
    address: optStr(read(raw, 'address', 'location')),
    status: optStr(read(raw, 'status', 'availabilityStatus', 'spotStatus')),
  };
}

function normalizeAdminDetail(raw: unknown): AdminUserDetail {
  const base = read(raw, 'profile', 'user') ?? raw;
  const vehicles = read(raw, 'vehicles') ?? read(base, 'vehicles');
  const spots = read(raw, 'ownedParkingSpots', 'parkingSpots') ?? read(base, 'ownedParkingSpots', 'parkingSpots');
  const wallet = read(raw, 'wallet', 'walletSummary');
  const profile = normalizeProfile(raw);

  if (isRecord(wallet)) {
    profile.summary.walletBalance = num(read(wallet, 'balance', 'walletBalance')) || profile.summary.walletBalance;
    profile.summary.walletOnHold = num(read(wallet, 'onHold', 'onHoldBalance', 'walletOnHold')) || profile.summary.walletOnHold;
  }

  return {
    ...profile,
    googleId: optStr(read(raw, 'googleId') ?? read(base, 'googleId')),
    vehicles: Array.isArray(vehicles) ? vehicles.map(normalizeVehicle) : [],
    ownedParkingSpots: Array.isArray(spots) ? spots.map(normalizeSpot) : [],
  };
}

async function parseEnvelope(response: Response, fallback: string): Promise<Wire> {
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  const payload = await response.json().catch(() => null) as unknown;
  if (!isRecord(payload)) throw new Error(`${fallback} The server returned an unreadable response.`);
  if (read(payload, 'success') === false) {
    throw new Error(str(read(payload, 'message')) || fallback);
  }
  return payload;
}

async function toProfileResult(response: Response, fallback: string): Promise<UserProfileResult> {
  const payload = await parseEnvelope(response, fallback);
  const data = read(payload, 'data') ?? payload;
  const profile = normalizeProfile(data);
  if (!profile.userId) throw new Error(`${fallback} The response did not include a user profile.`);

  return {
    message: str(read(payload, 'message')),
    profile,
    jwtToken: optStr(read(payload, 'jwtToken', 'token') ?? read(data, 'jwtToken', 'token')),
  };
}

// ---------------------------------------------------------------------------
// A. Self-service profile APIs ([Authorize])
// ---------------------------------------------------------------------------

/** GET /api/user/profile */
export async function getMyProfile(token: string): Promise<UserProfileResult> {
  const response = await apiRequest('/user/profile', {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  return toProfileResult(response, 'Unable to load your profile.');
}

/** PUT /api/user/profile — returns a refreshed jwtToken. */
export async function updateMyProfile(token: string, request: UpdateUserProfileRequest): Promise<UserProfileResult> {
  const body: UpdateUserProfileRequest = {};
  if (request.firstName !== undefined) body.firstName = request.firstName.trim();
  if (request.lastName !== undefined) body.lastName = request.lastName.trim();
  if (request.phoneNumber !== undefined) body.phoneNumber = request.phoneNumber.trim();

  const response = await apiRequest('/user/profile', {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  });
  return toProfileResult(response, 'Unable to update your profile.');
}

/** Client-side mirror of the backend picture rules (.jpg/.jpeg/.png/.webp, ≤ 5 MB). */
export function validateProfilePicture(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!PROFILE_PICTURE_EXTENSIONS.includes(extension)) {
    return 'Please choose a JPG, PNG, or WEBP image.';
  }
  if (file.size > PROFILE_PICTURE_MAX_BYTES) {
    return 'Profile pictures must be 5 MB or smaller.';
  }
  return null;
}

/** POST /api/user/profile/picture (multipart field `picture`). */
export async function uploadProfilePicture(token: string, file: File): Promise<UserProfileResult> {
  const validationError = validateProfilePicture(file);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.append('picture', file);

  const response = await apiRequest('/user/profile/picture', {
    method: 'POST',
    // No Content-Type: the browser sets the multipart boundary.
    headers: authorizationHeaders(token),
    body: formData,
  });
  return toProfileResult(response, 'Unable to upload your profile picture.');
}

/** DELETE /api/user/profile/picture */
export async function removeProfilePicture(token: string): Promise<UserProfileResult> {
  const response = await apiRequest('/user/profile/picture', {
    method: 'DELETE',
    headers: authorizationHeaders(token),
  });
  return toProfileResult(response, 'Unable to remove your profile picture.');
}

/**
 * POST /api/user/profile/deactivate (alias of DELETE /api/user/profile).
 * The POST alias is used so the JSON body is never dropped by intermediaries.
 */
export async function deactivateMyAccount(token: string, reason?: string): Promise<string> {
  const body: DeactivateAccountRequest = { confirmDeactivation: true };
  if (reason?.trim()) body.reason = reason.trim();

  const response = await apiRequest('/user/profile/deactivate', {
    method: 'POST',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(body),
  });
  const payload = await parseEnvelope(response, 'Unable to deactivate your account.');
  return str(read(payload, 'message')) || 'Your account has been deactivated.';
}

// ---------------------------------------------------------------------------
// B. Admin user governance APIs ([Authorize(Policy = "AdminOnly")])
// ---------------------------------------------------------------------------

/** GET /api/admin/users */
export async function getAdminUsers(token: string, query: AdminUserListQuery = {}): Promise<AdminUserListResult> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.userType) params.set('userType', String(query.userType));
  if (query.accountStatus) params.set('accountStatus', query.accountStatus);
  if (typeof query.isProfileComplete === 'boolean') params.set('isProfileComplete', String(query.isProfileComplete));
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 20)));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  const response = await apiRequest(`/admin/users?${params.toString()}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  const payload = await parseEnvelope(response, 'Unable to load users.');
  const data = read(payload, 'data');
  const list = Array.isArray(data)
    ? data
    : Array.isArray(read(data, 'users', 'items'))
      ? read(data, 'users', 'items') as unknown[]
      : Array.isArray(read(payload, 'users', 'items'))
        ? read(payload, 'users', 'items') as unknown[]
        : null;
  if (!list) throw new Error('The user service returned an unreadable user list.');

  const meta = read(payload, 'pagination') ?? (isRecord(data) ? data : payload);
  const resolvedPageSize = num(read(meta, 'pageSize') ?? read(payload, 'pageSize')) || pageSize;
  const totalCount = num(read(meta, 'totalCount', 'total') ?? read(payload, 'totalCount', 'total')) || list.length;
  const totalPages = num(read(meta, 'totalPages') ?? read(payload, 'totalPages'))
    || Math.max(1, Math.ceil(totalCount / resolvedPageSize));

  return {
    users: list.map(normalizeProfile),
    page: num(read(meta, 'page', 'currentPage') ?? read(payload, 'page')) || page,
    pageSize: resolvedPageSize,
    totalCount,
    totalPages: Math.max(1, totalPages),
  };
}

/** GET /api/admin/users/{userId} */
export async function getAdminUserDetail(token: string, userId: number): Promise<AdminUserDetail> {
  const response = await apiRequest(`/admin/users/${encodeURIComponent(String(userId))}`, {
    method: 'GET',
    headers: authorizationHeaders(token),
  });
  const payload = await parseEnvelope(response, 'Unable to load this user.');
  const detail = normalizeAdminDetail(read(payload, 'data') ?? payload);
  if (!detail.userId) throw new Error('The user detail response was incomplete.');
  return detail;
}

/** PUT /api/admin/users/{userId} */
export async function adminUpdateUser(
  token: string,
  userId: number,
  request: AdminUpdateUserProfileRequest,
): Promise<{ message: string; user: AdminUserDetail }> {
  const response = await apiRequest(`/admin/users/${encodeURIComponent(String(userId))}`, {
    method: 'PUT',
    headers: authorizationHeaders(token, 'application/json'),
    body: JSON.stringify(request),
  });
  const payload = await parseEnvelope(response, 'Unable to update this user.');
  return {
    message: str(read(payload, 'message')) || 'User updated successfully.',
    user: normalizeAdminDetail(read(payload, 'data') ?? payload),
  };
}
