import { apiRequest } from '@/services/apiClient';

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
  userType: number;
}): Promise<Response> {
  return apiRequest('/auth/complete-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
