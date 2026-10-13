import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { Habit, HabitRecord, HabitStat, HabitTemplate } from '../types';

export const habitKeys = {
  list: ['habits'] as const,
  templates: ['habit-templates'] as const,
  stats: (from: string, to: string) => ['habits', 'stats', from, to] as const,
};

export function useHabits() {
  return useQuery({
    queryKey: habitKeys.list,
    queryFn: () => apiFetch<Habit[]>('/habits'),
  });
}

export function useHabitTemplates() {
  return useQuery({
    queryKey: habitKeys.templates,
    queryFn: () => apiFetch<HabitTemplate[]>('/habit-templates'),
    staleTime: 10 * 60_000,
  });
}

export function useHabitStats(from: string, to: string) {
  return useQuery({
    queryKey: habitKeys.stats(from, to),
    queryFn: () => apiFetch<HabitStat[]>('/habits/stats', { query: { from, to } }),
  });
}

export interface HabitInput {
  name: string;
  icon?: string | null;
  color?: number | null;
  goalType?: number;
  targetValue?: number;
  unit?: string | null;
  frequency?: number;
  weekDays?: number[];
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HabitInput) => apiFetch<Habit>('/habits', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useHabitFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiFetch<Habit>('/habits/from-template', { method: 'POST', body: { templateId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<HabitInput> & { id: string; archived?: boolean }) =>
      apiFetch<Habit>(`/habits/${id}`, { method: 'PATCH', body: patch }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/habits/${id}`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

function patchRecord(habits: Habit[] | undefined, habitId: string, date: string, value: number | null): Habit[] | undefined {
  if (!habits) return habits;
  return habits.map((habit) => {
    if (habit.id !== habitId) return habit;
    const records = [...(habit.records ?? [])];
    const index = records.findIndex((r) => r.date.slice(0, 10) === date);
    if (value === null) {
      if (index >= 0) records.splice(index, 1);
    } else if (index >= 0) {
      records[index] = { ...records[index], value };
    } else {
      records.push({ id: `optimistic-${date}`, habitId, date, value });
    }
    return { ...habit, records };
  });
}

/** 打卡（计数型用累加后的 value），乐观更新并失败回滚。 */
export function useCheckHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, value }: { id: string; date: string; value: number }) =>
      apiFetch<HabitRecord>(`/habits/${id}/check`, { method: 'POST', body: { date, value } }),
    onMutate: async ({ id, date, value }) => {
      await qc.cancelQueries({ queryKey: habitKeys.list });
      const previous = qc.getQueryData<Habit[]>(habitKeys.list);
      qc.setQueryData<Habit[]>(habitKeys.list, (old) => patchRecord(old, id, date, value));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(habitKeys.list, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useUncheckHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      apiFetch<{ ok: boolean }>(`/habits/${id}/uncheck`, { method: 'POST', body: { date } }),
    onMutate: async ({ id, date }) => {
      await qc.cancelQueries({ queryKey: habitKeys.list });
      const previous = qc.getQueryData<Habit[]>(habitKeys.list);
      qc.setQueryData<Habit[]>(habitKeys.list, (old) => patchRecord(old, id, date, null));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(habitKeys.list, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}