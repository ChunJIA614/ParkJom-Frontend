import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
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
const loadCommuterDashboard = () => import('@/features/commuter/pages/CommuterDashboard');
const CommuterDashboard = lazy(loadCommuterDashboard);
const ParkingDetail = lazy(() => import('@/features/commuter/pages/ParkingDetail'));
const ParkingReview = lazy(() => import('@/features/commuter/pages/ParkingReview'));
const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));
const loadOwnerDashboard = () => import('@/features/owner/pages/OwnerDashboard');
const OwnerDashboard = lazy(loadOwnerDashboard);
const NotificationCenterPage = lazy(() => import('@/features/notifications/pages/NotificationCenterPage'));
const PublicParkingPayPage = lazy(() => import('@/features/publicParking/pages/PublicParkingPayPage'));

export function AppRoutes() {
  const { isLoggedIn, isGuest, loading, user } = useAuth();
  const [welcomeFinished, setWelcomeFinished] = useState(false);
  const [welcomeError, setWelcomeError] = useState('');
  const welcomeCompletionPending = useRef(false);
  const showWelcome = isLoggedIn && user && !welcomeFinished && shouldShowWelcomeScreen(user.userId, user.role);

  useEffect(() => {
    setWelcomeFinished(false);
    setWelcomeError('');
    welcomeCompletionPending.current = false;
  }, [isLoggedIn, user?.userId]);

  useEffect(() => {
    if (!showWelcome || !user) return;
    const preload = user.role === 'Owner' ? loadOwnerDashboard : loadCommuterDashboard;
    void preload().catch(() => {}); // Completion below keeps the artwork visible if loading is slow.
  }, [Boolean(showWelcome), user?.role]);

  const finishWelcome = useCallback(async () => {
    if (!user || welcomeCompletionPending.current) return;
    welcomeCompletionPending.current = true;
    setWelcomeError('');
    try {
      await (user.role === 'Owner' ? loadOwnerDashboard() : loadCommuterDashboard());
      markWelcomeScreenCompleted(user.userId);
      setWelcomeFinished(true);
    } catch {
      setWelcomeError('Your dashboard could not load. Check your connection and try again.');
    } finally {
      welcomeCompletionPending.current = false;
    }
  }, [user]);

  if (loading) return null;

  if (!isLoggedIn) {
    return (
      <div className="font-sans text-[#1d1d1f] page-shell">
        <Suspense fallback={null}>
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
            {/* Public Drive-In Parking Checkout & Payment */}
            <Route path="/public-pay" element={<PublicParkingPayPage />} />
            <Route path="/commuter/public-pay" element={<PublicParkingPayPage />} />
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
        onComplete={finishWelcome}
        loadError={welcomeError}
      />
    );
  }

  const dashboardPath = getDashboardPath(user?.role);

  return (
    <div className="page-shell">
      <Suspense fallback={null}>
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
          {/* Public Drive-In Parking Checkout & Payment */}
          <Route path="/public-pay" element={<PublicParkingPayPage />} />
          <Route path="/commuter/public-pay" element={<PublicParkingPayPage />} />
          <Route path="*" element={<Navigate to={dashboardPath} replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
