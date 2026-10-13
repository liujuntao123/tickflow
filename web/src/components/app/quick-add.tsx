'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCreateTask } from '@/lib/hooks/use-tasks';
import { useUiStore } from '@/lib/ui-store';
import { cn, endOfDayIso } from '@/lib/utils';

/** 极简快捷语法：识别 今天 / 明天，命中后从标题中移除并设置当天截止。 */
function parseQuick(raw: string): { title: string; dueDate: string | null } {
  let dueDate: string | null = null;
  let title = raw;
  if (/今天/.test(title)) {
    dueDate = endOfDayIso(0);
    title = title.replace(/今天\s*/, '');
  } else if (/明天/.test(title)) {
    dueDate = endOfDayIso(1);
    title = title.replace(/明天\s*/, '');
  }
  title = title.trim();
  return { title: title || raw.trim(), dueDate };
}

export function QuickAdd({
  listId,
  defaultDue,
  placeholder = '添加任务，回车创建',
  className,
}: {
  listId?: string | null;
  defaultDue?: string | null;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState('');
  const create = useCreateTask();
  const selectTask = useUiStore((s) => s.selectTask);

  function submit() {
    const raw = value.trim();
    if (!raw) return;
    const parsed = parseQuick(raw);
    setValue('');
    create.mutate(
      { title: parsed.title, listId: listId ?? undefined, dueDate: parsed.dueDate ?? defaultDue ?? null, priority: 0 },
      {
        onSuccess: (task) => {
          if (task?.id) selectTask(task.id);
        },
      },
    );
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900', className)}>
      <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
        }}
        disabled={create.isPending}
        className="h-10 flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={submit}
          className="rounded-lg bg-brand-500 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-brand-600"
        >
          添加
        </button>
      )}
    </div>
  );
}