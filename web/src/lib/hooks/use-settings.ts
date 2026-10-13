import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { User, UserSettings } from '../types';

export const settingsKeys = {
  settings: ['settings'] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.settings,
    queryFn: () => apiFetch<UserSettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) =>
      apiFetch<UserSettings>('/settings', { method: 'PUT', body: patch }),
    onMutate: (patch) => {
      qc.setQueryData<UserSettings>(settingsKeys.settings, (old) => (old ? { ...old, ...patch } : old));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: settingsKeys.settings }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { displayName?: string; timezone?: string }) =>
      apiFetch<{ user: User }>('/users/me', { method: 'PATCH', body: patch }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}