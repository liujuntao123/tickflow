import { apiFetch } from '../api';
import type { User } from '../types';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export function login(input: { email: string; password: string }) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { ...input, platform: 'web', deviceId: 'web-1' },
  });
}

export function register(input: { email: string; password: string; displayName: string; timezone?: string }) {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      ...input,
      timezone: input.timezone ?? 'Asia/Shanghai',
      platform: 'web',
      deviceId: 'web-1',
    },
  });
}

export function fetchMe() {
  return apiFetch<{ user: User }>('/auth/me', { redirectOn401: false, retry: false });
}

export function logout(all = false) {
  return apiFetch<{ ok?: boolean }>('/auth/logout', { method: 'POST', query: { all } });
}