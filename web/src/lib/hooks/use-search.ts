import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { SearchResult } from '../types';

export function useSearch(q: string, types = 'task,list,tag') {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['search', trimmed, types],
    enabled: trimmed.length > 0,
    queryFn: () =>
      apiFetch<{ results: SearchResult[] }>('/search', {
        query: { q: trimmed, types, limit: 50 },
      }),
  });
}