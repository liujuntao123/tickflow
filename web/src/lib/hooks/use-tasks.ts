import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { unwrap } from './use-org';
import type { ListResponse, Task, TaskList, ViewResponse } from '../types';
import { TASK_STATUS } from '../constants';

export const taskKeys = {
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
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiFetch<Task>(`/tasks/${id}/${completed ? 'complete' : 'uncomplete'}`, { method: 'POST' }),
    onMutate: ({ id, completed }) => {
      patchTaskEverywhere(qc, id, {
        status: completed ? TASK_STATUS.COMPLETED : TASK_STATUS.OPEN,
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSettled: () => invalidateTaskData(qc),
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