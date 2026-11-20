import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleLogin, googleLogout, type CredentialResponse } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { useAuth, type UserRole } from '../context/AuthContext';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Car, Check, Home, Loader2, X } from 'lucide-react';
import {
  completeUserProfile,
  getPhoneOtpStatus,
  signInWithGoogle,
  verifyProfilePhoneOtp,
  type PhoneOtpFlowData,
  type PhoneOtpFlowResponse,
} from '../api/authApi';
import { isGoogleLoginCancellation, signInWithNativeGoogle } from '../googleAuth';
import { readApiError } from '@/services/apiClient';
import { markFreshLoginForWelcome } from '@/components/onboarding/onboardingStorage';

export type OnboardingStepState = {
  step: 'idle' | 'profile' | 'otp';
  phoneNumber?: string;
};

type GoogleLoginButtonProps = {
  onOnboardingChange?: (state: OnboardingStepState) => void;
};

const OTP_LENGTH = 6;

type AuthResponsePayload = {
  success?: boolean;
  message?: string;
  isProfileComplete?: boolean;
  jwtToken?: string;
  accountStatus?: string;
  user?: {
    userId?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    profilePictureURL?: string;
    phoneNumber?: string;
    userType?: number;
    accountStatus?: string;
  };
};

async function readPhoneFlowError(
  response: Response,
  fallback: string,
): Promise<{ message: string; data?: PhoneOtpFlowData | null }> {
  const responseText = await response.text().catch(() => '');
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText) as PhoneOtpFlowResponse & {
        error?: string;
        title?: string;
        Message?: string;
      };
      const message = parsed.message
        || parsed.Message
        || parsed.data?.smsErrorDescription
        || parsed.error
        || parsed.title
        || '';
      return {
        message: message || `${fallback} (HTTP ${response.status})`,
        data: parsed.data ?? null,
      };
    } catch {
      return {
        message: responseText.trim() || `${fallback} (HTTP ${response.status})`,
      };
    }
  }
  return { message: `${fallback} (HTTP ${response.status})` };
}

function isTerminalSmsStatus(status?: string | null): boolean {
  if (!status) return false;
  return /^(delivered|failed|undelivered|rejected|expired|cancelled)$/i.test(status.trim());
}

export default function GoogleLoginButton({ onOnboardingChange }: GoogleLoginButtonProps) {
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();

  // For new users: pre-select role from URL (e.g. /login?role=Owner)
  // For existing users: role comes from DB, this default is ignored
  const roleParam = searchParams.get('role');
  const defaultRole = roleParam === 'Owner' ? 2 : 3; // 2=Owner, 3=Commuter

  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState<number>(defaultRole);
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);
  const [isGoogleLoginPending, setIsGoogleLoginPending] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [loginError, setLoginError] = useState('');

  // SMS OTP verification state (Step 2b)
  const [otpStep, setOtpStep] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
  const [otpSmsStatus, setOtpSmsStatus] = useState<string | null>(null);
  const [otpSmsError, setOtpSmsError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const otpCode = otpDigits.join('');
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const loginRequestInFlightRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number>(320);

  // Notify LoginPage so the header & surrounding chrome adapt cleanly to the active step
  useEffect(() => {
    if (!onOnboardingChange) return;
    if (!pendingUserId) {
      onOnboardingChange({ step: 'idle' });
    } else if (otpStep) {
      onOnboardingChange({ step: 'otp', phoneNumber: otpPhoneNumber || phoneNumber.trim() });
    } else {
      onOnboardingChange({ step: 'profile' });
    }
  }, [onOnboardingChange, pendingUserId, otpStep, otpPhoneNumber, phoneNumber]);

  // Focus the first OTP digit cell whenever entering Step 2b
  useEffect(() => {
    if (!otpStep) return;
    const frame = window.requestAnimationFrame(() => {
      otpInputRefs.current[0]?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [otpStep]);

  // Measure container and adapt width smoothly on mobile screens so Google's pill never overflows or cuts off
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const updateWidth = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth > 0) {
        // Clamp between 220px and 360px (Google GIS max button width is 400, min is 200)
        // Subtly leave 8px margin so the pill has breathing room
        const calculated = Math.min(360, Math.max(220, Math.floor(containerWidth - 8)));
        setButtonWidth(calculated);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const smsStatusFinal = isTerminalSmsStatus(otpSmsStatus);

  // Poll SMS delivery status while waiting for the 6-digit OTP
  useEffect(() => {
    if (!otpStep || !pendingToken || smsStatusFinal) return;
    let cancelled = false;
    let attempts = 0;

    const pollStatus = async () => {
      attempts += 1;
      try {
        const res = await getPhoneOtpStatus(pendingToken);
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as PhoneOtpFlowResponse;
        const flow = payload.data;
        if (!flow || cancelled) return;
        if (flow.smsDeliveryStatus) setOtpSmsStatus(flow.smsDeliveryStatus);
        if (flow.smsErrorDescription) setOtpSmsError(flow.smsErrorDescription);
        if (isTerminalSmsStatus(flow.smsDeliveryStatus) || attempts >= 6) {
          window.clearInterval(intervalId);
        }
      } catch {
        // Ignore transient status polling failures; the user can still enter the OTP.
      }
    };

    const intervalId = window.setInterval(() => {
      void pollStatus();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [otpStep, pendingToken, smsStatusFinal]);

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

    const accountStatus = (data.user?.accountStatus ?? data.accountStatus)?.trim().toLowerCase();
    if (accountStatus === 'suspended') {
      throw new Error('This account has been suspended. Please contact ParkJom support.');
    }
    if (accountStatus === 'deactivated') {
      throw new Error('This account has been deactivated. Please contact ParkJom support to reactivate.');
    }

    const userId = Number(data.user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('The login response was incomplete. Please try again.');
    }

    // Step 1a: Profile incomplete → show phone verification
    if (!data.isProfileComplete) {
      setPendingToken(data.jwtToken ?? null);
      setPendingUserId(userId);
      if (data.user?.phoneNumber) {
        setPhoneNumber(data.user.phoneNumber);
      }
      if (data.user?.userType === 2 || data.user?.userType === 3) {
        setSelectedRole(data.user.userType);
      }
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

  // ---- Step 2a: Submit phone number & role to request 6-digit SMS OTP ----
  const requestPhoneOtp = async (isResend = false) => {
    const trimmed = (isResend ? otpPhoneNumber || phoneNumber : phoneNumber).trim();
    if (!trimmed) {
      setPhoneError('Please enter your phone number.');
      return;
    }

    if (isResend) {
      setOtpError('');
      setIsResendingOtp(true);
    } else {
      setPhoneError('');
      setIsSubmittingPhone(true);
    }

    try {
      const res = await completeUserProfile({
        userId: pendingUserId,
        phoneNumber: trimmed,
        userType: selectedRole,
        token: pendingToken,
      });

      if (!res.ok) {
        const { message, data } = await readPhoneFlowError(res, 'Failed to send verification code');
        if (data?.resendAfterSeconds && data.resendAfterSeconds > 0) {
          setResendCooldown(Math.ceil(data.resendAfterSeconds));
        }
        if (data?.smsErrorDescription) {
          setOtpSmsError(data.smsErrorDescription);
        }
        throw new Error(message);
      }

      const payload = (await res.json()) as AuthResponsePayload & PhoneOtpFlowResponse;

      // Backwards-compatible fallback if the backend immediately returns a completed AuthResponse
      if (payload.user && (payload.jwtToken?.trim() || pendingToken?.trim()) && payload.isProfileComplete !== false) {
        finishLogin(payload, true);
        return;
      }

      if (payload.success === false) {
        throw new Error(payload.message || payload.data?.smsErrorDescription || 'Failed to send verification code.');
      }

      const flow = payload.data;
      setOtpPhoneNumber(flow?.phoneNumber?.trim() || trimmed);
      setOtpSmsStatus(flow?.smsDeliveryStatus ?? null);
      setOtpSmsError(flow?.smsErrorDescription ?? null);
      setResendCooldown(Math.max(0, Math.ceil(Number(flow?.resendAfterSeconds ?? 0))));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpError('');
      setOtpStep(true);
      if (isResend) {
        window.requestAnimationFrame(() => otpInputRefs.current[0]?.focus());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send verification code. Please try again.';
      console.error('❌ Phone OTP request failed:', message);
      if (isResend) {
        setOtpError(message);
      } else {
        setPhoneError(message);
      }
    } finally {
      if (isResend) {
        setIsResendingOtp(false);
      } else {
        setIsSubmittingPhone(false);
      }
    }
  };

  const handlePhoneSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    void requestPhoneOtp(false);
  };

  // ---- Step 2b: Verify 6-digit SMS OTP and complete profile ----
  const handleVerifyOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    if (!pendingToken) {
      setOtpError('Your sign-in session expired. Please sign in with Google again.');
      return;
    }

    setOtpError('');
    setIsVerifyingOtp(true);

    try {
      const res = await verifyProfilePhoneOtp({
        otp: cleanOtp,
        token: pendingToken,
      });

      if (!res.ok) {
        const { message, data } = await readPhoneFlowError(res, 'Failed to verify code');
        if (data?.smsErrorDescription) {
          setOtpSmsError(data.smsErrorDescription);
        }
        throw new Error(message);
      }

      const data = (await res.json()) as AuthResponsePayload;
      if (data.success === false) {
        throw new Error(data.message || 'Invalid verification code. Please try again.');
      }

      finishLogin(data, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Phone verification failed. Please try again.';
      console.error('❌ Phone OTP verification failed:', message);
      setOtpError(message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ---- Finish login: store user and redirect ----
  const finishLogin = (data: AuthResponsePayload, isNewRegistration = false) => {
    // Backend enum: Admin=1, PropertyOwner=2, Renter=3
    const userTypeMap: Record<number, UserRole> = { 1: 'Admin', 2: 'Owner', 3: 'Commuter' };
    const backendUser = data.user;
    if (!backendUser) {
      throw new Error(data.message || 'The login response was incomplete. Please try again.');
    }

    const userType = Number(backendUser.userType);
    const role = userTypeMap[userType];
    const resolvedToken = data.jwtToken?.trim() || pendingToken?.trim() || '';
    if (!role || !resolvedToken) {
      throw new Error(data.message || 'The login response was incomplete. Please try again.');
    }

    if (backendUser.userId) {
      markFreshLoginForWelcome(backendUser.userId, isNewRegistration);
    }

    setUser({
      userId: backendUser.userId!,
      email: backendUser.email ?? '',
      firstName: backendUser.firstName ?? '',
      lastName: backendUser.lastName ?? '',
      picture: backendUser.profilePictureURL ?? '',
      phoneNumber: backendUser.phoneNumber ?? '',
      userType,
      role,
      token: resolvedToken,
      isProfileComplete: true,
      accountStatus: backendUser.accountStatus ?? data.accountStatus,
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
    setPendingToken(null);
    setPendingUserId(null);
    setPhoneNumber('');
    setPhoneError('');
    setLoginError('');
    setOtpStep(false);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpPhoneNumber('');
    setOtpSmsStatus(null);
    setOtpSmsError(null);
    setResendCooldown(0);
    setOtpError('');
  };

  // ---- 6-digit OTP box handlers ----
  const applyOtpString = (startIndex: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    setOtpError('');
    setOtpDigits((prev) => {
      const next = [...prev];
      const offset = digits.length >= OTP_LENGTH ? 0 : startIndex;
      for (let i = 0; i < digits.length && offset + i < OTP_LENGTH; i += 1) {
        next[offset + i] = digits[i];
      }
      return next;
    });
    const offset = digits.length >= OTP_LENGTH ? 0 : startIndex;
    const focusIndex = Math.min(offset + digits.length, OTP_LENGTH - 1);
    window.requestAnimationFrame(() => {
      otpInputRefs.current[focusIndex]?.focus();
    });
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    setOtpError('');

    if (!digits) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    // Multi-character entry (OS SMS autofill or paste via onChange)
    if (digits.length > 1) {
      applyOtpString(index, digits);
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digits;
      return next;
    });
    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      setOtpError('');
      if (otpDigits[index]) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        otpInputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      setOtpError('');
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      otpInputRefs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      otpInputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleOtpPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted) return;
    event.preventDefault();
    applyOtpString(index, pasted);
  };

  // ---- Show 6-digit SMS OTP verification form (Step 2b) ----
  if (pendingUserId && otpStep) {
    const normalizedStatus = otpSmsStatus?.trim().toLowerCase();
    return (
      <form onSubmit={handleVerifyOtp} className="login-onboarding" noValidate>
        {normalizedStatus === 'delivered' && (
          <div className="login-otp-status" aria-live="polite">
            <span className="login-otp-status__dot" aria-hidden="true" />
            <span>SMS delivered to {otpPhoneNumber}</span>
          </div>
        )}

        {otpSmsError && (
          <p role="alert" className="login-form-error">
            Unable to deliver SMS: {otpSmsError}
          </p>
        )}

        <div className="login-onboarding__group">
          <span className="login-onboarding__label" id="otp-group-label">
            6-digit code
          </span>
          <div
            className="login-otp-grid"
            role="group"
            aria-labelledby="otp-group-label"
          >
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpInputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                aria-invalid={Boolean(otpError)}
                maxLength={index === 0 ? OTP_LENGTH : 2}
                value={digit}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={(e) => handleOtpPaste(index, e)}
                className={`login-otp-cell${digit ? ' login-otp-cell--filled' : ''}${otpError ? ' login-otp-cell--error' : ''}`}
              />
            ))}
          </div>
          {otpError && (
            <p role="alert" className="login-form-error">{otpError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isVerifyingOtp || otpCode.length !== OTP_LENGTH}
          aria-busy={isVerifyingOtp}
          className="login-submit-button"
        >
          {isVerifyingOtp ? (
            <>
              <Loader2 size={17} aria-hidden="true" className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              Verify &amp; Continue
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>

        <div className="login-onboarding__actions">
          <button
            type="button"
            disabled={resendCooldown > 0 || isResendingOtp}
            onClick={() => void requestPhoneOtp(true)}
            className="login-text-action login-text-action--primary"
          >
            {isResendingOtp
              ? 'Sending code…'
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpStep(false);
              setOtpDigits(Array(OTP_LENGTH).fill(''));
              setOtpError('');
              setOtpSmsError(null);
            }}
            className="login-text-action"
          >
            Change number
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseDifferentAccount}
          className="login-text-action"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Use a different account
        </button>
      </form>
    );
  }

  // ---- Show phone & role form when profile is incomplete (Step 2a) ----
  if (pendingUserId) {
    return (
      <form onSubmit={handlePhoneSubmit} className="login-onboarding" noValidate>
        <fieldset className="login-onboarding__group">
          <legend className="login-onboarding__label">How will you use ParkJom?</legend>
          <div className="login-role-grid">
            <button
              type="button"
              aria-pressed={selectedRole === 3}
              onClick={() => setSelectedRole(3)}
              className="login-role-card"
            >
              <span className="login-role-card__top" aria-hidden="true">
                <span className="login-role-card__icon">
                  <Car size={17} strokeWidth={1.85} />
                </span>
                <span className="login-role-card__check">
                  <Check size={11} strokeWidth={2.75} />
                </span>
              </span>
              <span className="login-role-card__title">Commuter</span>
              <span className="login-role-card__desc">Find and book parking near transit.</span>
            </button>

            <button
              type="button"
              aria-pressed={selectedRole === 2}
              onClick={() => setSelectedRole(2)}
              className="login-role-card"
            >
              <span className="login-role-card__top" aria-hidden="true">
                <span className="login-role-card__icon">
                  <Home size={17} strokeWidth={1.85} />
                </span>
                <span className="login-role-card__check">
                  <Check size={11} strokeWidth={2.75} />
                </span>
              </span>
              <span className="login-role-card__title">Property Owner</span>
              <span className="login-role-card__desc">List your bay and earn from idle hours.</span>
            </button>
          </div>
        </fieldset>

        <div className="login-onboarding__group">
          <label htmlFor="onboarding-phone" className="login-onboarding__label">
            Mobile number
          </label>
          <div className="login-input-wrap">
            <input
              id="onboarding-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 0123456789"
              aria-invalid={Boolean(phoneError)}
              value={phoneNumber}
              onChange={(e) => { setPhoneNumber(e.target.value); setPhoneError(''); }}
              className={`login-input${phoneNumber ? ' login-input--with-clear' : ''}${phoneError ? ' login-input--error' : ''}`}
            />
            {phoneNumber && (
              <button
                type="button"
                aria-label="Clear mobile number"
                onClick={() => { setPhoneNumber(''); setPhoneError(''); }}
                className="login-input-clear"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {phoneError && (
            <p role="alert" className="login-form-error">{phoneError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmittingPhone || !phoneNumber.trim()}
          aria-busy={isSubmittingPhone}
          className="login-submit-button"
        >
          {isSubmittingPhone ? (
            <>
              <Loader2 size={17} aria-hidden="true" className="animate-spin" />
              Sending code…
            </>
          ) : (
            <>
              Send Verification Code
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleUseDifferentAccount}
          className="login-text-action"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Use a different account
        </button>
      </form>
    );
  }

  // ---- Default: show Google Sign-In button ----
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {isGoogleLoginPending ? (
        <button
          type="button"
          disabled
          aria-busy="true"
          className="login-google-button flex min-h-11 w-full max-w-[320px] cursor-wait items-center justify-center gap-2.5 rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-[#1d1d1f] shadow-sm opacity-80"
        >
          <Loader2 size={17} aria-hidden="true" className="animate-spin text-[#007AFF]" />
          <span aria-live="polite">Signing you in…</span>
        </button>
      ) : Capacitor.isNativePlatform() ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleNativeGoogleLogin}
          className="login-google-button flex min-h-11 w-full max-w-[320px] items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-[#1d1d1f] shadow-sm"
        >
          <span aria-hidden="true" className="text-[17px] font-bold text-[#4285f4]">G</span>
          Continue with Google
        </motion.button>
      ) : (
        <div ref={wrapperRef} className="w-full flex justify-center items-center overflow-hidden py-0.5 max-w-full">
          <div
            style={{
              width: buttonWidth,
              maxWidth: '100%',
              colorScheme: 'light',
            }}
            className="flex justify-center items-center rounded-full overflow-hidden"
          >
            <GoogleLogin
              // Re-mount on width change so the GIS button cleanly re-renders at the exact fitted width
              key={`google-light-${buttonWidth}`}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              width={buttonWidth}
              containerProps={{ className: 'google-signin-shell flex justify-center w-full max-w-full' }}
            />
          </div>
        </div>
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
