import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import SplashScreen from '@/components/common/SplashScreen';
import { RequireRole } from './RequireRole';
import { getDashboardPath } from './roleRouting';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const CommuterDashboard = lazy(() => import('@/features/commuter/pages/CommuterDashboard'));
const ParkingDetail = lazy(() => import('@/features/commuter/pages/ParkingDetail'));
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));
const OwnerDashboard = lazy(() => import('@/features/owner/pages/OwnerDashboard'));

function RouteLoadingFallback() {
  return (
    <div
      className="page-shell flex min-h-screen items-center justify-center px-6 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-sm font-medium text-[#6e6e73]">Loading ParkJom…</p>
    </div>
  );
}

export function AppRoutes() {
  const { isLoggedIn, loading, user } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!isLoggedIn) {
    return (
      <div className="font-sans text-[#1d1d1f] page-shell">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  const dashboardPath = getDashboardPath(user?.role);

  return (
    <div className="page-shell">
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/admin" element={<RequireRole role="Admin"><AdminDashboard /></RequireRole>} />
          <Route path="/owner" element={<RequireRole role="Owner"><OwnerDashboard /></RequireRole>} />
          <Route path="/commuter" element={<RequireRole role="Commuter"><CommuterDashboard /></RequireRole>} />
          <Route path="/commuter/parking/:id" element={<RequireRole role="Commuter"><ParkingDetail /></RequireRole>} />
          <Route path="*" element={<Navigate to={dashboardPath} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
