import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { FocusSession, FocusStats } from '../types';

export const focusKeys = {
  current: ['focus', 'current'] as const,
  stats: (from: string, to: string) => ['focus', 'stats', from, to] as const,
};

export function useCurrentFocus() {
  return useQuery({
    queryKey: focusKeys.current,
    // 后端在无进行中会话时返回空响应体，这里统一归一为 null，避免下游拿到 undefined。
    queryFn: async () => (await apiFetch<FocusSession | null>('/focus/sessions/current')) ?? null,
  });
}

export function useFocusStats(from: string, to: string) {
  return useQuery({
    queryKey: focusKeys.stats(from, to),
    queryFn: () => apiFetch<FocusStats>('/focus/stats', { query: { from, to, granularity: 'day' } }),
  });
}

function invalidateFocus(qc: ReturnType<typeof useQueryClient>) {
  // 进行中会话 + 统计（今日 / 近 7 天）一起失效
  qc.invalidateQueries({ queryKey: focusKeys.current });
  qc.invalidateQueries({ queryKey: ['focus', 'stats'] });
}

export function useCreateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId?: string | null; mode?: number; plannedSeconds: number }) =>
      apiFetch<FocusSession>('/focus/sessions', { method: 'POST', body: input }),
    onSuccess: (session) => {
      qc.setQueryData(focusKeys.current, session);
    },
    onSettled: () => invalidateFocus(qc),
  });
}

export function usePatchFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      actualSeconds,
      breakSeconds,
    }: {
      id: string;
      action: 'pause' | 'resume' | 'complete' | 'cancel';
      actualSeconds?: number;
      breakSeconds?: number;
    }) => apiFetch<FocusSession>(`/focus/sessions/${id}`, { method: 'PATCH', body: { action, actualSeconds, breakSeconds } }),
    onSuccess: (session) => {
      // 完成 / 放弃后立即把 current 置空，UI 无需等待重新请求
      qc.setQueryData(focusKeys.current, session.status === 0 || session.status === 1 ? session : null);
    },
    // 暂停 / 恢复 / 完成 / 放弃 后统一失效 current 与 stats
    onSettled: () => invalidateFocus(qc),
  });
}