/**
 * Property Management module contracts.
 * Mirrors ParkJomV2 `DTOs/PropertyManagementDTO.cs` and the routes exposed by
 * `PropertyManagementAuthController`, `PropertyManagementController`, and
 * `AdminPropertyManagementAccountsController`.
 */

/** Backend enum `UserType.PropertyManagement`. */
export const PROPERTY_MANAGEMENT_USER_TYPE = 4;

export type ManagementAccountStatus = 'Active' | 'Deactivated' | 'Suspended';

export const MANAGEMENT_ACCOUNT_STATUSES: ManagementAccountStatus[] = ['Active', 'Suspended', 'Deactivated'];

/** Backend `BookingStatus` enum names. */
export type ManagementBookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed' | 'Expired' | 'Active';

export const MANAGEMENT_BOOKING_STATUSES: ManagementBookingStatus[] = [
  'Pending',
  'Confirmed',
  'Active',
  'Completed',
  'Cancelled',
  'Expired',
];

export interface ManagementProfile {
  managementAccountId: number;
  email: string;
  username: string;
  mustChangePassword: boolean;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
}

export interface ManagementLoginResponse {
  code: number;
  success: boolean;
  message: string;
  jwtToken: string;
  mustChangePassword: boolean;
  data: ManagementProfile;
}

export interface PagedResponse<T> {
  code: number;
  success: boolean;
  message: string;
  totalCount: number;
  page: number;
  pageSize: number;
  data: T[];
}

export interface ManagementBooking {
  bookingId: number;
  bookingReference: string;
  parkingSpotId: number;
  parkingLabel: string | null;
  vehicleNumberPlate: string;
  bookingStatus: ManagementBookingStatus | string;
  /** Malaysia local time without an offset, as stored by the backend. */
  startDate: string;
  endDate: string;
  checkedInAt: string | null;
  actualExitAt: string | null;
}

export interface ManagementBookingQuery {
  parkingSpotId?: number;
  status?: ManagementBookingStatus | '';
  /** yyyy-MM-dd (Malaysia date). */
  fromDate?: string;
  /** yyyy-MM-dd (Malaysia date). */
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ManagementAccessEvent {
  ioTStatusLogId: number;
  bookingId: number;
  parkingSpotId: number;
  parkingLabel: string | null;
  vehicleNumberPlate: string;
  enteredAtUtc: string;
  firstEntryForBooking: boolean;
}

export interface ManagementAccessEventQuery {
  /** yyyy-MM-dd (Malaysia date), inclusive. */
  fromDate?: string;
  /** yyyy-MM-dd (Malaysia date), inclusive. */
  toDate?: string;
  parkingSpotId?: number;
  plate?: string;
  page?: number;
  pageSize?: number;
}

export type PlateCheckDecision =
  | 'BOOKING_MATCH'
  | 'INVALID_PLATE'
  | 'PLATE_CONFIDENCE_TOO_LOW'
  | 'BOOKING_ACCESS_WINDOW_CLOSED'
  | 'NO_ELIGIBLE_BOOKING';

export interface PlateCheckResult {
  allowed: boolean;
  decisionCode: PlateCheckDecision | string;
  propertyId: number;
  bookingId: number | null;
  parkingSpotId: number | null;
  detectedPlate: string;
  formattedPlate: string;
  confidence: number;
  minimumConfidence: number;
  /** Backend message describing the decision. */
  message: string;
}

export interface PlateCheckLog {
  accessLogId: number;
  checkedAtUtc: string;
  outcome: 'allowed' | 'denied' | string;
  details: string;
  bookingId: number | null;
}

/* ── Admin provisioning ── */

export interface ManagementAccount {
  managementAccountId: number;
  email: string;
  username: string;
  propertyId: number;
  propertyName: string;
  accountStatus: ManagementAccountStatus | string;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  invitationEmailStatus?: 'sent' | 'simulated' | 'failed' | string | null;
  invitationLink?: string | null;
  smtpErrorMessage?: string | null;
}

export interface ManagementInvitationLinkResponse {
  code: number;
  success: boolean;
  message: string;
  invitationLink: string;
  expiresAtUtc: string;
}

export interface ManagementAccountCreateRequest {
  propertyId: number;
  email: string;
  username: string;
}

export interface ManagementAccountUpdateRequest {
  email?: string;
  username?: string;
  propertyId?: number;
  status?: ManagementAccountStatus;
  resendInvitation?: boolean;
}
