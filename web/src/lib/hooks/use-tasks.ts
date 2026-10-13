import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { unwrap } from './use-org';
import type { ListResponse, Task, TaskList, ViewResponse } from '../types';
import { TASK_STATUS } from '../constants';

export const taskKeys = {
  all: ['tasks', 'all'] as const,
  byList: (listId: string) => ['tasks', 'list', listId] as const,
  byTag: (tagId: string) => ['tasks', 'tag', tagId] as const,
  detail: (id: string) => ['task', id] as const,
};

export interface CreateTaskInput {
  title: string;
  listId?: string;
  parentId?: string | null;
  priority?: number;
  dueDate?: string | null;
  notes?: string | null;
  tagIds?: string[];
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  notes?: string | null;
  priority?: number;
  dueDate?: string | null;
  isAllDay?: boolean;
  listId?: string;
  tagIds?: string[];
  status?: number;
  recurrenceRule?: string | null;
  recurrenceTz?: string | null;
  recurrenceDtstart?: string | null;
  repeatFrom?: number;
  reminders?: { offset: number }[] | null;
  checklist?: Task['checklist'];
}

/** 全部任务（含子任务），用于子任务计数、通知与日历的重复展开兜底。 */
export function useAllTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: async () => {
      const data = await apiFetch<ListResponse<Task>>('/tasks', { query: { limit: 500 } });
      return data.items;
    },
    staleTime: 30_000,
  });
}

/** parentId → 子任务进度，避免为每个任务单独拉详情。 */
export function useSubtaskCounts() {
  const { data: tasks = [] } = useAllTasks();
  return useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = map.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === TASK_STATUS.COMPLETED) cur.done += 1;
      map.set(t.parentId, cur);
    }
    return map;
  }, [tasks]);
}

export function useTasksByList(listId: string | null) {
  return useQuery({
    queryKey: taskKeys.byList(listId ?? '__none__'),
    enabled: !!listId,
    queryFn: async () => {
      const data = await apiFetch<ListResponse<Task>>('/tasks', {
        query: { listId: listId!, topLevel: true, limit: 500 },
      });
      return data.items;
    },
  });
}

export function useTasksByTag(tagId: string | null) {
  return useQuery({
    queryKey: taskKeys.byTag(tagId ?? '__none__'),
    enabled: !!tagId,
    queryFn: async () => {
      const data = await apiFetch<ListResponse<Task>>('/tasks', {
        query: { tagId: tagId!, topLevel: true, limit: 500 },
      });
      return data.items;
    },
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? '__none__'),
    enabled: !!id,
    queryFn: () => apiFetch<Task>(`/tasks/${id}`),
  });
}

/** 文件夹视图：拉取该文件夹下所有清单的任务并合并。 */
export function useTasksByFolder(folderId: string | null) {
  return useQuery({
    queryKey: ['tasks', 'folder', folderId ?? '__none__'],
    enabled: !!folderId,
    queryFn: async () => {
      const lists = unwrap(
        await apiFetch<TaskList[] | ListResponse<TaskList>>('/lists', { query: { includeArchived: false } }),
      );
      const inFolder = lists.filter((l) => l.folderId === folderId && !l.isInbox);
      const batches = await Promise.all(
        inFolder.map(async (l) => {
          const data = await apiFetch<ListResponse<Task>>('/tasks', {
            query: { listId: l.id, topLevel: true, limit: 500 },
          });
          return data.items;
        }),
      );
      return batches.flat();
    },
  });
}

function patchTaskInArray(tasks: Task[], id: string, patch: Partial<Task>): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

/** 在所有任务/视图缓存中就地更新某个任务字段（乐观更新用）。 */
export function patchTaskEverywhere(qc: QueryClient, id: string, patch: Partial<Task>) {
  qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
    Array.isArray(old) ? patchTaskInArray(old, id, patch) : old,
  );
  qc.setQueriesData<ViewResponse>({ queryKey: ['views'] }, (old) => {
    if (!old || !Array.isArray(old.groups)) return old;
    return {
      ...old,
      groups: old.groups.map((g) => ({ ...g, tasks: patchTaskInArray(g.tasks, id, patch) })),
    };
  });
  qc.setQueriesData<Task>({ queryKey: ['task', id] }, (old) => (old ? { ...old, ...patch } : old));
}

function invalidateTaskData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['task'] });
  qc.invalidateQueries({ queryKey: ['views'] });
  qc.invalidateQueries({ queryKey: ['counts'] });
  qc.invalidateQueries({ queryKey: ['lists'] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiFetch<Task>('/tasks', { method: 'POST', body: input }),
    onSuccess: (task) => {
      if (task?.listId) {
        qc.setQueryData<Task[]>(taskKeys.byList(task.listId), (old) =>
          old && !old.some((t) => t.id === task.id) ? [...old, task] : old,
        );
      }
      invalidateTaskData(qc);
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTaskInput) =>
      apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: patch }),
    onMutate: ({ id, ...patch }) => {
      patchTaskEverywhere(qc, id, patch as Partial<Task>);
    },
    onSettled: () => invalidateTaskData(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSettled: () => invalidateTaskData(qc),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    // 后端滚动语义（若已实现）会在响应中带 rolled 与新的 nextDueDate
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiFetch<Task & { rolled?: boolean }>(`/tasks/${id}/${completed ? 'complete' : 'uncomplete'}`, {
        method: 'POST',
      }),
    onMutate: ({ id, completed }) => {
      patchTaskEverywhere(qc, id, {
        status: completed ? TASK_STATUS.COMPLETED : TASK_STATUS.OPEN,
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSuccess: (task) => {
      // 重复任务完成即滚动：用服务端返回的最新字段就地更新，避免闪回已完成态
      if (task && (task as { rolled?: boolean }).rolled) {
        patchTaskEverywhere(qc, task.id, task);
      }
    },
    onSettled: () => invalidateTaskData(qc),
  });
}

/** 拖动排序：按 listId + parentId 重排，乐观更新对应缓存。 */
export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listId: string; parentId?: string | null; orderedIds: string[] }) =>
      apiFetch<{ ok: boolean }>('/tasks/reorder', {
        method: 'POST',
        body: { listId: input.listId, parentId: input.parentId ?? null, orderedIds: input.orderedIds },
      }),
    onMutate: ({ listId, orderedIds }) => {
      const order = new Map(orderedIds.map((id, index) => [id, index]));
      const applyOrder = (tasks: Task[]): Task[] => {
        const inList = tasks.filter((t) => t.listId === listId && !t.parentId);
        if (inList.length < 2) return tasks;
        inList.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
        let cursor = 0;
        return tasks.map((t) => (t.listId === listId && !t.parentId ? inList[cursor++] : t));
      };
      qc.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) => (Array.isArray(old) ? applyOrder(old) : old));
      qc.setQueriesData<ViewResponse>({ queryKey: ['views'] }, (old) => {
        if (!old || !Array.isArray(old.groups)) return old;
        return { ...old, groups: old.groups.map((g) => ({ ...g, tasks: applyOrder(g.tasks) })) };
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['views'] });
    },
  });
}

export function useChecklistUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checklist }: { id: string; checklist: Task['checklist'] }) =>
      apiFetch<Task>(`/tasks/${id}/checklist`, { method: 'POST', body: { checklist } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['task'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}