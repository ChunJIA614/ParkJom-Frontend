import type { AuthUser, UserRole } from '@/features/auth/context/AuthContext';
import type { BackendUserType, UserProfile } from '../types';

const ROLE_BY_USER_TYPE: Record<BackendUserType, UserRole> = {
  1: 'Admin',
  2: 'Owner',
  3: 'Commuter',
};

export const roleForUserType = (userType: BackendUserType): UserRole => ROLE_BY_USER_TYPE[userType];

/**
 * Merge a fresh profile (and optional refreshed JWT) into the stored session.
 * Changing `role` makes RequireRole redirect to the matching dashboard.
 */
export function mergeProfileIntoSession(current: AuthUser, profile: UserProfile, jwtToken?: string): AuthUser {
  return {
    ...current,
    userId: profile.userId || current.userId,
    email: profile.email || current.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    picture: profile.profilePictureURL,
    phoneNumber: profile.phoneNumber,
    userType: profile.userType,
    role: roleForUserType(profile.userType),
    token: jwtToken?.trim() || current.token,
    isProfileComplete: profile.isProfileComplete,
    accountStatus: profile.accountStatus || current.accountStatus,
  };
}
