import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import SplashScreen from '@/components/common/SplashScreen';
import WelcomeLoadingScreen from '@/components/onboarding/WelcomeLoadingScreen';
import {
  markWelcomeScreenCompleted,
  shouldShowWelcomeScreen,
} from '@/components/onboarding/onboardingStorage';
import { RequireRole } from './RequireRole';
import { getDashboardPath } from './roleRouting';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const ManagementInvitationPage = lazy(() => import('@/features/management/pages/ManagementInvitationPage'));
const PropertyManagementDashboard = lazy(() => import('@/features/management/pages/PropertyManagementDashboard'));
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const CommuterDashboard = lazy(() => import('@/features/commuter/pages/CommuterDashboard'));
const ParkingDetail = lazy(() => import('@/features/commuter/pages/ParkingDetail'));
const ParkingReview = lazy(() => import('@/features/commuter/pages/ParkingReview'));
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));
const OwnerDashboard = lazy(() => import('@/features/owner/pages/OwnerDashboard'));
const NotificationCenterPage = lazy(() => import('@/features/notifications/pages/NotificationCenterPage'));

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
  const { isLoggedIn, isGuest, loading, user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (isLoggedIn && user) {
      setShowWelcome(shouldShowWelcomeScreen(user.userId, user.role));
    } else {
      setShowWelcome(false);
    }
  }, [isLoggedIn, user?.userId, user?.role]);

  if (loading) {
    return <SplashScreen />;
  }

  if (!isLoggedIn) {
    return (
      <div className="font-sans text-[#1d1d1f] page-shell">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* The Login Page is the default main page on initial visit and after logout */}
            <Route path="/" element={isGuest ? <Navigate to="/commuter" replace /> : <LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* Standalone PropertyManagement 14-day single-use invitation link */}
            <Route path="/management/invitation" element={<ManagementInvitationPage />} />
            {/* Landing Page */}
            <Route path="/home" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            {/* Guest mode allows viewing Commuter dashboard (browse & transit maps) and parking details */}
            <Route path="/commuter" element={<CommuterDashboard />} />
            <Route path="/commuter/parking/:id" element={<ParkingDetail />} />
            <Route path="*" element={<Navigate to={isGuest ? "/commuter" : "/"} replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  if (showWelcome && user && (user.role === 'Commuter' || user.role === 'Owner')) {
    return (
      <WelcomeLoadingScreen
        user={user}
        onComplete={() => {
          markWelcomeScreenCompleted(user.userId);
          setShowWelcome(false);
        }}
      />
    );
  }

  const dashboardPath = getDashboardPath(user?.role);

  return (
    <div className="page-shell">
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/management/invitation" element={<ManagementInvitationPage />} />
          <Route path="/" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/home" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/landing" element={<Navigate to={dashboardPath} replace />} />
          <Route path="/admin" element={<RequireRole role="Admin"><AdminDashboard /></RequireRole>} />
          <Route path="/owner" element={<RequireRole role="Owner"><OwnerDashboard /></RequireRole>} />
          <Route path="/management" element={<RequireRole role="PropertyManagement"><PropertyManagementDashboard /></RequireRole>} />
          <Route path="/notifications" element={<NotificationCenterPage />} />
          <Route path="/commuter" element={<RequireRole role="Commuter"><CommuterDashboard /></RequireRole>} />
          <Route path="/commuter/parking/:id" element={<RequireRole role="Commuter"><ParkingDetail /></RequireRole>} />
          <Route path="/commuter/parking/:id/review" element={<RequireRole role="Commuter"><ParkingReview /></RequireRole>} />
          <Route path="*" element={<Navigate to={dashboardPath} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
