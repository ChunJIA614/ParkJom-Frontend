import { apiRequest } from '@/services/apiClient';

export interface PhoneOtpFlowData {
  phoneNumber?: string | null;
  verificationStatus?: string | null;
  smsDeliveryStatus?: string | null;
  smsErrorCode?: string | null;
  smsErrorDescription?: string | null;
  expiresAtUtc?: string;
  resendAfterSeconds?: number;
}

export interface PhoneOtpFlowResponse {
  code?: number;
  success?: boolean;
  message?: string | null;
  data?: PhoneOtpFlowData | null;
}

export function signInWithGoogle(googleToken: string): Promise<Response> {
  return apiRequest('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleToken }),
  });
}

export function completeUserProfile(input: {
  userId: number | null;
  phoneNumber: string;
  userType?: number;
  token?: string | null;
}): Promise<Response> {
  const { token, ...payload } = input;
  return apiRequest('/auth/complete-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  }, { preserveSessionOnForbidden: true });
}

export function verifyProfilePhoneOtp(input: {
  otp: string;
  token?: string | null;
}): Promise<Response> {
  return apiRequest('/auth/complete-profile/verify-phone', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
    },
    body: JSON.stringify({ otp: input.otp }),
  }, { preserveSessionOnForbidden: true });
}

export function getPhoneOtpStatus(token?: string | null): Promise<Response> {
  return apiRequest('/auth/phone/otp/status', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }, { preserveSessionOnForbidden: true });
}
