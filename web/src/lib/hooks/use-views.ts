import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { ViewCounts, ViewResponse } from '../types';

export const viewKeys = {
  view: (key: string, groupBy: string) => ['views', key, groupBy] as const,
  counts: ['counts'] as const,
};

export function useView(key: string, groupBy: string, enabled = true) {
  return useQuery({
    queryKey: viewKeys.view(key, groupBy),
    enabled,
    queryFn: () => apiFetch<ViewResponse>(`/views/${key}`, { query: { groupBy } }),
  });
}

export function useViewCounts() {
  return useQuery({
    queryKey: viewKeys.counts,
    queryFn: () => apiFetch<ViewCounts>('/views/counts'),
    staleTime: 15_000,
  });
}

export function useCalendarView(from: string | null, to: string | null) {
  return useQuery({
    queryKey: ['views', 'calendar', from, to],
    enabled: !!from && !!to,
    queryFn: () => apiFetch<{ days: { date: string; tasks: unknown[] }[] }>('/views/calendar', { query: { from, to } }),
  });
}