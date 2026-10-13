'use client';

import { CheckCircle2, Circle, Flag, ListChecks, Pencil, Repeat, Trash2 } from 'lucide-react';
import { useDeleteTask, useToggleTask } from '@/lib/hooks/use-tasks';
import { useUiStore } from '@/lib/ui-store';
import { PRIORITY_COLORS, TASK_STATUS } from '@/lib/constants';
import { cn, colorToHex, dueTone, effectiveDue, formatDue } from '@/lib/utils';
import { IconButton } from '@/components/ui';
import { memo, useMemo, type ReactNode } from 'react';
import type { Tag, Task } from '@/lib/types';

export type SubtaskCount = { total: number; done: number };

const dueToneClass: Record<string, string> = {
  overdue: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400',
  today: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400',
  soon: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400',
  normal: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400',
};

function TaskRowInner({
  task,
  tags,
  subtaskCounts,
  dragHandle,
}: {
  task: Task;
  tags: Tag[];
  subtaskCounts: Map<string, SubtaskCount>;
  dragHandle?: ReactNode;
}) {
  // 只订阅“本行是否选中”，避免选中某行时 500 行全部重渲染
  const selected = useUiStore((s) => s.selectedTaskId === task.id);
  const selectTask = useUiStore((s) => s.selectTask);
  const toggle = useToggleTask();
  const remove = useDeleteTask();

  const completed = task.status === TASK_STATUS.COMPLETED;
  const due = effectiveDue(task);
  const tone = dueTone(due);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const taskTags = (task.tagIds ?? []).map((id) => tagMap.get(id)).filter((t): t is Tag => !!t);
  const checklist = task.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.checked).length;
  const childStat = subtaskCounts.get(task.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') selectTask(task.id);
      }}
      className={cn(
        'tf-cv-row group flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        selected
          ? 'border-brand-200 bg-brand-50/70 dark:border-brand-500/40 dark:bg-brand-500/10'
          : 'border-transparent hover:border-zinc-200 hover:bg-white hover:shadow-sm dark:hover:border-zinc-800 dark:hover:bg-zinc-800/50',
      )}
    >
      {dragHandle}
      <button
        type="button"
        aria-label={completed ? '标记为未完成' : '标记为已完成'}
        onClick={(e) => {
          e.stopPropagation();
          toggle.mutate({ id: task.id, completed: !completed });
        }}
        className="mt-0.5 shrink-0 text-zinc-300 transition-colors hover:text-brand-500"
        style={completed ? { color: '#3b6fe0' } : undefined}
      >
        {completed ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Circle className="h-[18px] w-[18px]" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[14px] leading-6',
              completed ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-100',
            )}
          >
            {task.title}
          </span>
          {task.priority > 0 && (
            <Flag
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: PRIORITY_COLORS[task.priority] ?? '#9ca3af' }}
              fill="currentColor"
            />
          )}
        </div>

        {(due || taskTags.length > 0 || checklist.length > 0 || childStat || task.recurrenceRule) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {due && (
              <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', dueToneClass[tone])}>
                {formatDue(due, task.isAllDay)}
              </span>
            )}
            {task.recurrenceRule && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <Repeat className="h-3 w-3" />
              </span>
            )}
            {childStat && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <ListChecks className="h-3 w-3" />
                {childStat.done}/{childStat.total}
              </span>
            )}
            {checklist.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <ListChecks className="h-3 w-3" />
                {checklistDone}/{checklist.length}
              </span>
            )}
            {taskTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorToHex(tag.color) }} />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          aria-label="编辑"
          onClick={(e) => {
            e.stopPropagation();
            selectTask(task.id);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          aria-label="删除"
          onClick={(e) => {
            e.stopPropagation();
            remove.mutate(task.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

/** 大列表下避免无关重渲染；props 均为稳定引用（task 仅在数据变化时更新）。 */
export const TaskRow = memo(TaskRowInner);