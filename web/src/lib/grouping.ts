import { startOfDay, addDays } from 'date-fns';
import type { GroupBy, Task, TaskList } from './types';
import { QUADRANT_LABELS } from './constants';
import { effectiveDue } from './utils';

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

const PRIORITY_ORDER: Record<number, number> = { 5: 0, 3: 1, 1: 2, 0: 3 };
const PRIORITY_LABEL: Record<number, string> = { 5: '高优先级', 3: '中优先级', 1: '低优先级', 0: '无优先级' };

function dateBucket(task: Task): { key: string; order: number } {
  const due = effectiveDue(task);
  if (!due) return { key: 'none', order: 5 };
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(due).getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { key: 'overdue', order: 0 };
  if (diff === 0) return { key: 'today', order: 1 };
  if (diff === 1) return { key: 'tomorrow', order: 2 };
  if (diff <= 7) return { key: 'week', order: 3 };
  return { key: 'later', order: 4 };
}

const DATE_LABELS: Record<string, string> = {
  overdue: '已过期',
  today: '今天',
  tomorrow: '明天',
  week: '未来 7 天',
  later: '更晚',
  none: '无日期',
};

export function groupTasks(tasks: Task[], groupBy: GroupBy, lists: TaskList[]): TaskGroup[] {
  if (groupBy === 'quadrant') {
    // 重要 = priority ∈ {3,5}；紧急 = 有效到期 ≤ 明天结束
    const urgentBefore = addDays(startOfDay(new Date()), 2).getTime();
    const order: string[] = ['q1', 'q2', 'q3', 'q4'];
    const buckets = new Map<string, Task[]>();
    for (const t of tasks) {
      const important = t.priority === 3 || t.priority === 5;
      const due = effectiveDue(t);
      const urgent = due ? due.getTime() < urgentBefore : false;
      const q = important && urgent ? 'q1' : important ? 'q2' : urgent ? 'q3' : 'q4';
      const arr = buckets.get(q) ?? [];
      arr.push(t);
      buckets.set(q, arr);
    }
    return order
      .filter((q) => buckets.has(q))
      .map((q) => ({ key: `q-${q}`, label: QUADRANT_LABELS[q] ?? q, tasks: buckets.get(q)! }));
  }

  if (groupBy === 'priority') {
    const buckets = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = String(PRIORITY_ORDER[t.priority] !== undefined ? t.priority : 0);
      const arr = buckets.get(key) ?? [];
      arr.push(t);
      buckets.set(key, arr);
    }
    return [...buckets.entries()]
      .sort((a, b) => (PRIORITY_ORDER[Number(a[0])] ?? 9) - (PRIORITY_ORDER[Number(b[0])] ?? 9))
      .map(([key, arr]) => ({ key: `p-${key}`, label: PRIORITY_LABEL[Number(key)] ?? '无优先级', tasks: arr }));
  }

  if (groupBy === 'date') {
    const buckets = new Map<string, { order: number; tasks: Task[] }>();
    for (const t of tasks) {
      const { key, order } = dateBucket(t);
      const entry = buckets.get(key) ?? { order, tasks: [] };
      entry.tasks.push(t);
      buckets.set(key, entry);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, entry]) => ({ key: `d-${key}`, label: DATE_LABELS[key] ?? key, tasks: entry.tasks }));
  }

  // groupBy === 'list'
  const orderIndex = new Map(lists.map((l, i) => [l.id, i]));
  const nameById = new Map(lists.map((l) => [l.id, l.name]));
  const buckets = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = buckets.get(t.listId) ?? [];
    arr.push(t);
    buckets.set(t.listId, arr);
  }
  return [...buckets.entries()]
    .sort((a, b) => (orderIndex.get(a[0]) ?? 9999) - (orderIndex.get(b[0]) ?? 9999))
    .map(([listId, arr]) => ({
      key: `l-${listId}`,
      label: nameById.get(listId) ?? '未知清单',
      tasks: arr,
    }));
}