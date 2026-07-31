import { Navigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useAuth, type UserRole } from '@/features/auth/context/AuthContext';
import { getDashboardPath } from './roleRouting';

interface RequireRoleProps extends PropsWithChildren {
  role: UserRole;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const { user } = useAuth();

  if (!user || user.role !== role) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }

  return <>{children}</>;
}
