import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleLogin, googleLogout, type CredentialResponse } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { useAuth, type UserRole } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { completeUserProfile, signInWithGoogle } from '../api/authApi';
import { isGoogleLoginCancellation, signInWithNativeGoogle } from '../googleAuth';
import { readApiError } from '@/services/apiClient';

type AuthResponsePayload = {
  success?: boolean;
  message?: string;
  isProfileComplete?: boolean;
  jwtToken?: string;
  user?: {
    userId?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    profilePictureURL?: string;
    phoneNumber?: string;
    userType?: number;
  };
};

// FedCM can reuse an already-approved account after the user presses the button.
// The Google chooser still appears when consent or an account choice is required.
const fedCmButtonOptions = {
  button_auto_select: true,
} as const;

export default function GoogleLoginButton() {
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();

  // For new users: pre-select role from URL (e.g. /login?role=Owner)
  // For existing users: role comes from DB, this default is ignored
  const roleParam = searchParams.get('role');
  const defaultRole = roleParam === 'Owner' ? 2 : 3; // 2=Owner, 3=Commuter

  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState<number>(defaultRole);
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);
  const [isGoogleLoginPending, setIsGoogleLoginPending] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [loginError, setLoginError] = useState('');
  const loginRequestInFlightRef = useRef(false);

  const beginGoogleLoginRequest = () => {
    if (loginRequestInFlightRef.current) return false;
    loginRequestInFlightRef.current = true;
    setIsGoogleLoginPending(true);
    setLoginError('');
    return true;
  };

  const finishGoogleLoginRequest = () => {
    loginRequestInFlightRef.current = false;
    setIsGoogleLoginPending(false);
  };

  const authenticateGoogleCredential = async (credential: string) => {
    const res = await signInWithGoogle(credential);

    if (!res.ok) {
      throw new Error(await readApiError(res, 'Backend login failed'));
    }

    const data = await res.json() as AuthResponsePayload;
    if (data.success === false) {
      throw new Error(data.message || 'Backend login failed');
    }

    const userId = Number(data.user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('The login response was incomplete. Please try again.');
    }

    // Step 1a: Profile incomplete → show phone verification
    if (!data.isProfileComplete) {
      setPendingUserId(userId);
      return;
    }

    const userType = Number(data.user?.userType);
    if (![1, 2, 3].includes(userType) || !data.jwtToken?.trim()) {
      throw new Error('The login response was incomplete. Please try again.');
    }

    // Step 1b: Profile complete → login immediately. AppRoutes redirects by role.
    finishLogin(data);
  };

  const handleGoogleCredential = async (credential?: string) => {
    if (!credential) {
      console.error('No credential received from Google');
      setLoginError('Google did not return a sign-in credential. Please try again.');
      return;
    }

    if (!beginGoogleLoginRequest()) return;

    try {
      await authenticateGoogleCredential(credential);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      const isUnavailable = message.includes('Failed to fetch') || message.includes('NetworkError');
      const displayMessage = isUnavailable
        ? 'The backend server is unavailable. Please try again shortly.'
        : message;
      console.error('❌ Google login failed:', displayMessage);
      setLoginError(displayMessage);
    } finally {
      finishGoogleLoginRequest();
    }
  };

  // ---- Step 1: Google login success ----
  const handleGoogleSuccess = ({ credential }: CredentialResponse) => handleGoogleCredential(credential);

  const handleNativeGoogleLogin = async () => {
    if (!beginGoogleLoginRequest()) return;

    try {
      await authenticateGoogleCredential(await signInWithNativeGoogle());
    } catch (error) {
      if (!isGoogleLoginCancellation(error)) {
        const message = error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
        console.error('Google sign-in failed:', message);
        setLoginError(message);
      }
    } finally {
      finishGoogleLoginRequest();
    }
  };

  // ---- Step 2: Submit phone number to complete profile ----
  const handlePhoneSubmit = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setPhoneError('Please enter your phone number.');
      return;
    }

    setPhoneError('');
    setIsSubmittingPhone(true);

    try {
      const res = await completeUserProfile({
        userId: pendingUserId,
        phoneNumber: trimmed,
        userType: selectedRole, // 2=Owner, 3=Commuter
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, 'Failed to complete profile'));
      }

      const data = await res.json();
      finishLogin(data);
    } catch (err: any) {
      console.error('❌ Phone verification failed:', err.message);
      setPhoneError(err.message);
    } finally {
      setIsSubmittingPhone(false);
    }
  };

  // ---- Finish login: store user and redirect ----
  const finishLogin = (data: AuthResponsePayload) => {
    // Backend enum: Admin=1, PropertyOwner=2, Renter=3
    const userTypeMap: Record<number, UserRole> = { 1: 'Admin', 2: 'Owner', 3: 'Commuter' };
    const backendUser = data.user!;
    const userType = backendUser.userType!;
    const role = userTypeMap[userType];

    setUser({
      userId: backendUser.userId!,
      email: backendUser.email ?? '',
      firstName: backendUser.firstName ?? '',
      lastName: backendUser.lastName ?? '',
      picture: backendUser.profilePictureURL ?? '',
      phoneNumber: backendUser.phoneNumber ?? '',
      userType,
      role,
      token: data.jwtToken!,
      isProfileComplete: true,
    });
  };

  // ---- Login failure handler ----
  const handleGoogleError = () => {
    finishGoogleLoginRequest();
    console.error('Google Sign-In encountered an error');
    setLoginError('Google sign-in was cancelled or could not be completed. Please try again.');
  };

  const handleUseDifferentAccount = () => {
    if (!Capacitor.isNativePlatform()) googleLogout();
    finishGoogleLoginRequest();
    setPendingUserId(null);
    setPhoneNumber('');
    setPhoneError('');
    setLoginError('');
  };

  // ---- Show phone verification form when profile is incomplete ----
  if (pendingUserId) {
    return (
      <div className="w-full space-y-4">
        <div className="text-left">
          <p className="text-[13px] font-medium text-[#1d1d1f]">Welcome! One more step.</p>
          <p className="text-[12px] text-[#6e6e73] mt-1">
            Verify your phone number and choose your role to complete your profile.
          </p>
        </div>

        {/* Role selector */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#6e6e73]">I am a...</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole(3)}
              className={`px-4 py-3 rounded-xl border text-[13px] font-semibold text-left transition-all
                ${selectedRole === 3
                  ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                  : 'bg-white text-[#1d1d1f] border-black/[0.08] hover:border-[#007AFF]/40'
                }`}
            >
              <span className="block text-[15px] mb-0.5">🚗</span>
              Commuter
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">I want to find & book parking</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole(2)}
              className={`px-4 py-3 rounded-xl border text-[13px] font-semibold text-left transition-all
                ${selectedRole === 2
                  ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                  : 'bg-white text-[#1d1d1f] border-black/[0.08] hover:border-[#007AFF]/40'
                }`}
            >
              <span className="block text-[15px] mb-0.5">🏠</span>
              Property Owner
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">I want to list my parking space</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <input
            type="tel"
            placeholder="Phone number (e.g. 0123456789)"
            value={phoneNumber}
            onChange={(e) => { setPhoneNumber(e.target.value); setPhoneError(''); }}
            className={`w-full px-4 py-3 rounded-xl border text-[14px] bg-white
              ${phoneError ? 'border-red-400' : 'border-black/[0.08]'}
              focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]
              transition-colors`}
          />
          {phoneError && (
            <p className="text-[12px] text-red-500 px-1">{phoneError}</p>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handlePhoneSubmit}
          disabled={isSubmittingPhone}
          className="w-full py-3 rounded-xl bg-[#007AFF] text-white text-[14px] font-semibold
            hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmittingPhone ? 'Verifying...' : 'Verify & Continue'}
        </motion.button>

        <button
          type="button"
          onClick={handleUseDifferentAccount}
          className="text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
        >
          ← Use a different account
        </button>
      </div>
    );
  }

  // ---- Default: show Google Sign-In button ----
  return (
    <div className="flex flex-col items-center gap-3">
      {isGoogleLoginPending ? (
        <button
          type="button"
          disabled
          aria-busy="true"
          className="flex min-h-11 w-[260px] max-w-full cursor-wait items-center justify-center gap-2.5 rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-[#1d1d1f] shadow-sm opacity-80"
        >
          <Loader2 size={17} aria-hidden="true" className="animate-spin text-[#007AFF]" />
          <span aria-live="polite">Signing you in…</span>
        </button>
      ) : Capacitor.isNativePlatform() ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleNativeGoogleLogin}
          className="flex min-h-11 w-[260px] max-w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-[#1d1d1f] shadow-sm"
        >
          <span aria-hidden="true" className="text-[17px] font-bold text-[#4285f4]">G</span>
          Continue with Google
        </motion.button>
      ) : (
        <GoogleLogin
          {...fedCmButtonOptions}
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          use_fedcm_for_button
          theme="outline"
          size="medium"
          shape="pill"
          text="continue_with"
          width={260}
        />
      )}
      <p className="text-[11px] text-[#8e8e93]">
        Use your Google account to sign in to ParkJom
      </p>
      {loginError && (
        <p role="alert" className="max-w-sm rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[12px] text-red-600">
          {loginError}
        </p>
      )}
    </div>
  );
}
