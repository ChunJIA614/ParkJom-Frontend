/**
 * Profile Management Module contracts.
 * Mirrors the backend `UserProfileDTO.cs` (UserProfileDTO, UserProfileSummaryDTO,
 * request models, AdminUserDetailDTO and response envelopes).
 */

/** Backend enum: Admin=1, PropertyOwner=2, Renter=3 */
export type BackendUserType = 1 | 2 | 3;
export type AccountStatus = 'Active' | 'Suspended' | 'Deactivated';

export const USER_TYPE_LABELS: Record<BackendUserType, string> = {
  1: 'Admin',
  2: 'Property Owner',
  3: 'Commuter',
};

export const ACCOUNT_STATUSES: AccountStatus[] = ['Active', 'Suspended', 'Deactivated'];

export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PICTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface UserProfileSummary {
  walletBalance: number;
  walletOnHold: number;
  vehicleCount: number;
  activeBookingsCount: number;
  totalBookingsCount: number;
  favoritesCount: number;
  ownedParkingSpotsCount: number;
  openSupportTicketsCount: number;
}

export interface UserProfile {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  profilePictureURL: string;
  userType: BackendUserType;
  roleName: string;
  isProfileComplete: boolean;
  accountStatus: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  summary: UserProfileSummary;
}

export interface UpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface DeactivateAccountRequest {
  reason?: string;
  confirmDeactivation: true;
}

export interface AdminUpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  userType?: BackendUserType;
  isProfileComplete?: boolean;
  accountStatus?: AccountStatus;
}

export interface AdminUserVehicle {
  vehicleId: number;
  numberPlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

export interface AdminUserParkingSpot {
  parkingSpotId: number;
  name: string;
  address?: string;
  status?: string;
}

export interface AdminUserDetail extends UserProfile {
  googleId?: string;
  vehicles: AdminUserVehicle[];
  ownedParkingSpots: AdminUserParkingSpot[];
}

/** Result of a self-service mutation; `jwtToken` is present when the backend refreshes it. */
export interface UserProfileResult {
  message: string;
  profile: UserProfile;
  jwtToken?: string;
}

export interface AdminUserListQuery {
  search?: string;
  userType?: BackendUserType;
  accountStatus?: AccountStatus;
  isProfileComplete?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminUserListResult {
  users: UserProfile[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
