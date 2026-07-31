import type { UserRole } from '@/features/auth/context/AuthContext';

export function getDashboardPath(role?: UserRole) {
  switch (role) {
    case 'Admin':
      return '/admin';
    case 'Owner':
      return '/owner';
    default:
      return '/commuter';
  }
}
