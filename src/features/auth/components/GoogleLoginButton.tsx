import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { useAuth, type UserRole } from '../context/AuthContext';
import { motion } from 'motion/react';
import { completeUserProfile, signInWithGoogle } from '../api/authApi';
import { isGoogleLoginCancellation, signInWithNativeGoogle } from '../googleAuth';
import { readApiError } from '@/services/apiClient';

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
  const [isNativeLoginPending, setIsNativeLoginPending] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleGoogleCredential = async (credential?: string) => {
    if (!credential) {
      console.error('No credential received from Google');
      setLoginError('Google did not return a sign-in credential. Please try again.');
      return;
    }

    setLoginError('');

    try {
      const res = await signInWithGoogle(credential);

      if (!res.ok) {
        throw new Error(await readApiError(res, 'Backend login failed'));
      }

      const data = await res.json();

      // Step 1a: Profile incomplete → show phone verification
      if (!data.isProfileComplete && data.user?.userId) {
        setPendingUserId(data.user.userId);
        return;
      }

      // Step 1b: Profile complete → login immediately
      finishLogin(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      const isUnavailable = message.includes('Failed to fetch') || message.includes('NetworkError');
      const displayMessage = isUnavailable
        ? 'The backend server is unavailable. Please try again shortly.'
        : message;
      console.error('❌ Google login failed:', displayMessage);
      setLoginError(displayMessage);
    }
  };

  // ---- Step 1: Google login success ----
  const handleGoogleSuccess = ({ credential }: CredentialResponse) => handleGoogleCredential(credential);

  const handleNativeGoogleLogin = async () => {
    setIsNativeLoginPending(true);
    setLoginError('');
    try {
      await handleGoogleCredential(await signInWithNativeGoogle());
    } catch (error) {
      if (!isGoogleLoginCancellation(error)) {
        const message = error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
        console.error('Google sign-in failed:', message);
        setLoginError(message);
      }
    } finally {
      setIsNativeLoginPending(false);
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
  const finishLogin = (data: any) => {
    // Backend enum: Admin=1, PropertyOwner=2, Renter=3
    const userTypeMap: Record<number, UserRole> = { 1: 'Admin', 2: 'Owner', 3: 'Commuter' };
    const role = userTypeMap[data.user?.userType] ?? 'Commuter';

    setUser({
      userId: data.user?.userId,
      email: data.user?.email,
      firstName: data.user?.firstName ?? '',
      lastName: data.user?.lastName ?? '',
      picture: data.user?.profilePictureURL ?? '',
      phoneNumber: data.user?.phoneNumber ?? '',
      userType: data.user?.userType,
      role,
      token: data.jwtToken,
      isProfileComplete: data.isProfileComplete ?? false,
    });
  };

  // ---- Login failure handler ----
  const handleGoogleError = () => {
    console.error('Google Sign-In encountered an error');
    setLoginError('Google sign-in was cancelled or could not be completed. Please try again.');
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
          onClick={() => setPendingUserId(null)}
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
      {Capacitor.isNativePlatform() ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleNativeGoogleLogin}
          disabled={isNativeLoginPending}
          className="flex min-h-11 items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-[#1d1d1f] shadow-sm disabled:opacity-60"
        >
          <span aria-hidden="true" className="text-[17px] font-bold text-[#4285f4]">G</span>
          {isNativeLoginPending ? 'Signing in…' : 'Sign in with Google'}
        </motion.button>
      ) : (
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          theme="outline"
          size="large"
          shape="pill"
          text="signin_with"
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
