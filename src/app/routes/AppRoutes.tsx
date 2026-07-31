import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import LoginPage from '@/features/auth/pages/LoginPage';
import AdminDashboard from '@/features/admin/pages/AdminDashboard';
import CommuterDashboard from '@/features/commuter/pages/CommuterDashboard';
import ParkingDetail from '@/features/commuter/pages/ParkingDetail';
import LandingPage from '@/features/landing/pages/LandingPage';
import OwnerDashboard from '@/features/owner/pages/OwnerDashboard';
import SplashScreen from '@/shared/ui/SplashScreen';
import { RequireRole } from './RequireRole';
import { getDashboardPath } from './roleRouting';

export function AppRoutes() {
  const { isLoggedIn, loading, user } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!isLoggedIn) {
    return (
      <div className="font-sans text-[#1d1d1f] page-shell">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  const dashboardPath = getDashboardPath(user?.role);

  return (
    <div className="page-shell">
      <Routes>
        <Route path="/login" element={<Navigate to={dashboardPath} replace />} />
        <Route path="/" element={<Navigate to={dashboardPath} replace />} />
        <Route path="/admin" element={<RequireRole role="Admin"><AdminDashboard /></RequireRole>} />
        <Route path="/owner" element={<RequireRole role="Owner"><OwnerDashboard /></RequireRole>} />
        <Route path="/commuter" element={<RequireRole role="Commuter"><CommuterDashboard /></RequireRole>} />
        <Route path="/commuter/parking/:id" element={<RequireRole role="Commuter"><ParkingDetail /></RequireRole>} />
        <Route path="*" element={<Navigate to={dashboardPath} replace />} />
      </Routes>
    </div>
  );
}
