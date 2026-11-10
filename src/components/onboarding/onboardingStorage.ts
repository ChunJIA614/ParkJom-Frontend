import type { UserRole } from '@/features/auth/context/AuthContext';

const WELCOME_SESSION_PREFIX = 'parkjom_welcome_seen_v1_';
const WELCOME_FORCE_KEY = 'parkjom_welcome_force_v1';
const TOUR_COMPLETED_PREFIX = 'parkjom_icon_tour_done_v1_';
const FIRST_TIME_USER_PREFIX = 'parkjom_first_time_user_v1_';

export function markFreshLoginForWelcome(userId: number, isNewRegistration = false): void {
  try {
    sessionStorage.removeItem(`${WELCOME_SESSION_PREFIX}${userId}`);
    sessionStorage.setItem(WELCOME_FORCE_KEY, String(userId));
    if (isNewRegistration) {
      localStorage.setItem(`${FIRST_TIME_USER_PREFIX}${userId}`, 'true');
      localStorage.removeItem(`${TOUR_COMPLETED_PREFIX}Commuter_${userId}`);
      localStorage.removeItem(`${TOUR_COMPLETED_PREFIX}Owner_${userId}`);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function shouldShowWelcomeScreen(userId?: number, role?: UserRole): boolean {
  if (!userId || (role !== 'Commuter' && role !== 'Owner')) {
    return false;
  }
  try {
    // Skip if returning from external payment redirect (e.g., Stripe top-up callback)
    const params = new URLSearchParams(window.location.search);
    if (params.has('status') || params.has('session_id')) {
      sessionStorage.setItem(`${WELCOME_SESSION_PREFIX}${userId}`, 'true');
      return false;
    }

    const forcedUser = sessionStorage.getItem(WELCOME_FORCE_KEY);
    if (forcedUser === String(userId)) {
      return true;
    }

    return sessionStorage.getItem(`${WELCOME_SESSION_PREFIX}${userId}`) !== 'true';
  } catch {
    return false;
  }
}

export function markWelcomeScreenCompleted(userId?: number): void {
  if (!userId) return;
  try {
    sessionStorage.setItem(`${WELCOME_SESSION_PREFIX}${userId}`, 'true');
    sessionStorage.removeItem(WELCOME_FORCE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function clearWelcomeSession(userId?: number): void {
  try {
    sessionStorage.removeItem(WELCOME_FORCE_KEY);
    if (userId) {
      sessionStorage.removeItem(`${WELCOME_SESSION_PREFIX}${userId}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export function isFirstTimeUserForTour(userId?: number, role?: UserRole): boolean {
  if (!userId || (role !== 'Commuter' && role !== 'Owner')) {
    return false;
  }
  try {
    return localStorage.getItem(`${TOUR_COMPLETED_PREFIX}${role}_${userId}`) !== 'true';
  } catch {
    return false;
  }
}

export function isNewRegisteredUser(userId?: number): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${FIRST_TIME_USER_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

export function markIconTourCompleted(userId?: number, role?: UserRole): void {
  if (!userId || !role) return;
  try {
    localStorage.setItem(`${TOUR_COMPLETED_PREFIX}${role}_${userId}`, 'true');
    localStorage.removeItem(`${FIRST_TIME_USER_PREFIX}${userId}`);
  } catch {
    // Ignore storage errors
  }
}
