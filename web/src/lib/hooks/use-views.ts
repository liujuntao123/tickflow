import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiFetch } from '../api';
import { expandOccurrences } from '../rrule';
import { useAllTasks } from './use-tasks';
import type { Task, ViewCounts, ViewResponse } from '../types';

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

export interface CalendarEntry {
  task: Task;
  occurrenceDate: string;
}

export interface CalendarDay {
  date: string;
  items: CalendarEntry[];
}

/**
 * 日历数据：以服务端展开结果为准（含 occurrenceDate）。
 * 若后端未展开重复（旧版无 occurrenceDate），端上按 RRULE 兜底展开并去重合并；
 * 由于服务端区间为 [from, to)，这里把查询上界顺延一天以包含 to 当天。
 */
export function useCalendarData(fromIso: string, toIso: string) {
  const queryTo = useMemo(() => {
    const t = new Date(toIso);
    return Number.isNaN(t.getTime()) ? toIso : new Date(t.getTime() + 86400000).toISOString();
  }, [toIso]);
  const server = useCalendarView(fromIso, queryTo);
  const { data: allTasks = [] } = useAllTasks();

  const serverExpands = useMemo(
    () =>
      (server.data?.days ?? []).some((day) =>
        day.tasks.some((t) => typeof (t as { occurrenceDate?: unknown }).occurrenceDate === 'string'),
      ),
    [server.data],
  );

  const days = useMemo<CalendarDay[]>(() => {
    const map = new Map<string, CalendarEntry[]>();
    const seen = new Set<string>();
    const add = (date: string, task: Task, occurrenceDate: string) => {
      const dedupeKey = `${task.id}|${date}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const arr = map.get(date) ?? [];
      arr.push({ task, occurrenceDate });
      map.set(date, arr);
    };

    for (const day of server.data?.days ?? []) {
      for (const raw of day.tasks) {
        const task = raw as Task & { occurrenceDate?: string };
        add(day.date, task, task.occurrenceDate ?? day.date);
      }
    }

    if (!serverExpands) {
      const from = new Date(fromIso);
      const to = new Date(toIso);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        for (const task of allTasks) {
          if (!task.recurrenceRule) continue;
          const anchorRaw = task.recurrenceDtstart ?? task.nextDueDate ?? task.dueDate;
          if (!anchorRaw) continue;
          const anchor = new Date(anchorRaw);
          if (Number.isNaN(anchor.getTime())) continue;
          for (const occurrence of expandOccurrences(task.recurrenceRule, anchor, from, to)) {
            add(format(occurrence, 'yyyy-MM-dd'), task, occurrence.toISOString());
          }
        }
      }
    }

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => ({ date, items }));
  }, [server.data, serverExpands, allTasks, fromIso, toIso]);

  return { days, isLoading: server.isLoading, isError: server.isError };
}