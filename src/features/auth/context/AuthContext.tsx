import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { AUTH_REJECTED_EVENT } from '@/services/apiClient';

// ---- Types ----
export type UserRole = 'Commuter' | 'Owner' | 'Admin';

export interface AuthUser {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  picture: string;       // profilePictureURL from backend
  phoneNumber: string;
  userType: number;       // enum: Renter=0, Owner=1, Admin=2
  role: UserRole;
  token: string;          // backend JWT (jwtToken)
  isProfileComplete: boolean;
  accountStatus?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  isLoggedIn: boolean;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  isLoggedIn: false,
  loading: true,
  logout: () => {},
});

// ---- Provider ----
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore login state from localStorage on page load (sync to avoid flicker)
  useEffect(() => {
    const saved = localStorage.getItem('parkjom_user');
    if (saved) {
      try {
        const restored = JSON.parse(saved) as AuthUser;
        if (restored.accountStatus?.toLowerCase() === 'suspended') {
          localStorage.removeItem('parkjom_user');
        } else {
          setUser(restored);
        }
      } catch {
        localStorage.removeItem('parkjom_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const clearRejectedSession = () => setUser(null);
    window.addEventListener(AUTH_REJECTED_EVENT, clearRejectedSession);
    return () => window.removeEventListener(AUTH_REJECTED_EVENT, clearRejectedSession);
  }, []);

  // Sync user state to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('parkjom_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('parkjom_user');
    }
  }, [user]);

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoggedIn: !!user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---- Hook ----
export const useAuth = () => useContext(AuthContext);
