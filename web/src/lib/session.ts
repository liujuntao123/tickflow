import { create } from 'zustand';
import type { User } from './types';

export type SessionStatus = 'loading' | 'authed' | 'guest';

interface SessionState {
  accessToken: string | null;
  user: User | null;
  status: SessionStatus;
  setAccessToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setStatus: (status: SessionStatus) => void;
  clear: () => void;
}

/**
 * access token 仅存内存（zustand），刷新页面后由后端 cookie 静默续期。
 */
export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: 'guest' }),
}));