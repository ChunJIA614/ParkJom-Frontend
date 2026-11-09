import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, AUTH_REJECTED_EVENT } from '@/services/apiClient';
import GuestLoginPromptModal from '../components/GuestLoginPromptModal';
import { clearWelcomeSession } from '@/components/onboarding/onboardingStorage';

// ---- Types ----
export type UserRole = 'Commuter' | 'Owner' | 'Admin' | 'PropertyManagement';

export interface AuthUser {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  picture: string;       // profilePictureURL from backend
  phoneNumber: string;
  userType: number;       // enum: Admin=1, PropertyOwner=2, Renter=3, PropertyManagement=4
  role: UserRole;
  token: string;          // backend JWT (jwtToken)
  isProfileComplete: boolean;
  accountStatus?: string;
  /** Assigned property metadata for standalone PropertyManagement accounts. */
  propertyId?: number;
  propertyName?: string;
  propertyAddress?: string;
}

export interface GuestPromptState {
  isOpen: boolean;
  featureName?: string;
  reason?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  isLoggedIn: boolean;
  isGuest: boolean;
  loading: boolean;
  logout: () => void;
  continueAsGuest: () => void;
  exitGuestMode: () => void;
  guestPrompt: GuestPromptState | null;
  promptLogin: (featureName?: string, reason?: string) => void;
  closeLoginPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  isLoggedIn: false,
  isGuest: false,
  loading: true,
  logout: () => {},
  continueAsGuest: () => {},
  exitGuestMode: () => {},
  guestPrompt: null,
  promptLogin: () => {},
  closeLoginPrompt: () => {},
});

// ---- Provider ----
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestPrompt, setGuestPrompt] = useState<GuestPromptState | null>(null);

  // Restore login state or guest state from localStorage on page load
  useEffect(() => {
    const saved = localStorage.getItem('parkjom_user');
    if (saved) {
      try {
        const restored = JSON.parse(saved) as AuthUser;
        const accountStatus = restored.accountStatus?.toLowerCase();
        if (accountStatus === 'suspended' || accountStatus === 'deactivated') {
          localStorage.removeItem('parkjom_user');
          const guestSaved = localStorage.getItem('parkjom_guest_mode') === 'true';
          setIsGuest(guestSaved);
        } else {
          setUser(restored);
          setIsGuest(false);
        }
      } catch {
        localStorage.removeItem('parkjom_user');
        const guestSaved = localStorage.getItem('parkjom_guest_mode') === 'true';
        setIsGuest(guestSaved);
      }
    } else {
      const guestSaved = localStorage.getItem('parkjom_guest_mode') === 'true';
      setIsGuest(guestSaved);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const clearRejectedSession = () => {
      setUser(null);
    };
    window.addEventListener(AUTH_REJECTED_EVENT, clearRejectedSession);
    return () => window.removeEventListener(AUTH_REJECTED_EVENT, clearRejectedSession);
  }, []);

  // Sync user state to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('parkjom_user', JSON.stringify(user));
      setIsGuest(false);
      localStorage.removeItem('parkjom_guest_mode');
    } else {
      localStorage.removeItem('parkjom_user');
    }
  }, [user]);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    localStorage.setItem('parkjom_guest_mode', 'true');
  }, []);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    localStorage.removeItem('parkjom_guest_mode');
  }, []);

  const promptLogin = useCallback((featureName?: string, reason?: string) => {
    setGuestPrompt({
      isOpen: true,
      featureName,
      reason,
    });
  }, []);

  const closeLoginPrompt = useCallback(() => {
    setGuestPrompt(null);
  }, []);

  const handleModalSignIn = useCallback(() => {
    closeLoginPrompt();
    navigate('/login', { state: { fromGuestPrompt: true } });
  }, [closeLoginPrompt, navigate]);

  const logout = useCallback(() => {
    if (user?.token) {
      const logoutPath = user.role === 'PropertyManagement' || user.userType === 4
        ? '/auth/management/logout'
        : '/auth/logout';
      void apiRequest(logoutPath, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      }).catch((err) => console.warn('Server logout notice failed:', err));
    }
    clearWelcomeSession(user?.userId);
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('parkjom_guest_mode');
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isLoggedIn: !!user,
        isGuest,
        loading,
        logout,
        continueAsGuest,
        exitGuestMode,
        guestPrompt,
        promptLogin,
        closeLoginPrompt,
      }}
    >
      {children}
      <GuestLoginPromptModal
        isOpen={Boolean(guestPrompt?.isOpen)}
        featureName={guestPrompt?.featureName}
        reason={guestPrompt?.reason}
        onClose={closeLoginPrompt}
        onSignIn={handleModalSignIn}
      />
    </AuthContext.Provider>
  );
}

// ---- Hook ----
export const useAuth = () => useContext(AuthContext);
