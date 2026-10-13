import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { Folder, ListResponse, Tag, TaskList } from '../types';

/** 兼容数组与 { items } 两种返回形态。 */
export function unwrap<T>(data: T[] | ListResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export const orgKeys = {
  folders: ['folders'] as const,
  lists: (folderId?: string) => ['lists', folderId ?? 'all'] as const,
  allLists: ['lists'] as const,
  tags: ['tags'] as const,
};

function invalidateOrg(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['folders'] });
  qc.invalidateQueries({ queryKey: ['lists'] });
  qc.invalidateQueries({ queryKey: ['tags'] });
}

/* ------------------------------- folders ------------------------------- */

export function useFolders() {
  return useQuery({
    queryKey: orgKeys.folders,
    queryFn: async () => unwrap(await apiFetch<Folder[] | ListResponse<Folder>>('/folders')),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: number }) =>
      apiFetch<Folder>('/folders', { method: 'POST', body: input }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: number }) =>
      apiFetch<Folder>(`/folders/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, strategy = 'inbox' }: { id: string; strategy?: 'inbox' | 'cascade' }) =>
      apiFetch<void>(`/folders/${id}`, { method: 'DELETE', query: { strategy } }),
    onSuccess: () => {
      invalidateOrg(qc);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

/* -------------------------------- lists -------------------------------- */

export function useLists() {
  return useQuery({
    queryKey: orgKeys.allLists,
    queryFn: async () =>
      unwrap(await apiFetch<TaskList[] | ListResponse<TaskList>>('/lists', { query: { includeArchived: false } })),
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; folderId?: string | null; color?: number }) =>
      apiFetch<TaskList>('/lists', { method: 'POST', body: input }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: number; folderId?: string | null }) =>
      apiFetch<TaskList>(`/lists/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateOrg(qc);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

/* --------------------------------- tags --------------------------------- */

export function useTags() {
  return useQuery({
    queryKey: orgKeys.tags,
    queryFn: async () => unwrap(await apiFetch<Tag[] | ListResponse<Tag>>('/tags')),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: number }) =>
      apiFetch<Tag>('/tags', { method: 'POST', body: input }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: number }) =>
      apiFetch<Tag>(`/tags/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidateOrg(qc),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateOrg(qc);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}