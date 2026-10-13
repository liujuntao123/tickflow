'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Circle, Square, Trash2 } from 'lucide-react';
import { useChecklistUpdate } from '@/lib/hooks/use-tasks';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui';
import type { ChecklistItem } from '@/lib/types';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function ChecklistEditor({ taskId, checklist }: { taskId: string; checklist: ChecklistItem[] | null }) {
  const update = useChecklistUpdate();
  const [items, setItems] = useState<ChecklistItem[]>(checklist ?? []);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setItems(checklist ?? []);
    // 仅在切换任务时用服务端数据重置，避免与本地编辑互相覆盖
  }, [taskId]);

  const done = items.filter((i) => i.checked).length;

  function commit(next: ChecklistItem[]) {
    const normalized = next.map((item, index) => ({ ...item, sortOrder: index }));
    setItems(normalized);
    update.mutate({ id: taskId, checklist: normalized });
  }

  function addItem() {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    commit([...items, { id: newId(), title, checked: false, sortOrder: items.length }]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <div className="space-y-1">
      {items.length > 0 && (
        <div className="mb-1 text-[11px] text-zinc-400">
          {done}/{items.length} 已完成
        </div>
      )}

      {items.map((item, index) => (
        <div
          key={item.id}
          className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        >
          <button
            type="button"
            aria-label="切换完成"
            onClick={() =>
              commit(items.map((it) => (it.id === item.id ? { ...it, checked: !it.checked } : it)))
            }
            className={cn('shrink-0', item.checked ? 'text-brand-500' : 'text-zinc-300 hover:text-brand-500')}
          >
            {item.checked ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
          <input
            value={item.title}
            onChange={(e) => setItems(items.map((it) => (it.id === item.id ? { ...it, title: e.target.value } : it)))}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (!title) {
                commit(items.filter((it) => it.id !== item.id));
                return;
              }
              commit(items.map((it) => (it.id === item.id ? { ...it, title } : it)));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className={cn(
              'h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-[13px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 dark:focus:bg-zinc-900',
              item.checked ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200',
            )}
          />
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <IconButton aria-label="上移" onClick={() => move(index, -1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton aria-label="下移" onClick={() => move(index, 1)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton aria-label="删除" onClick={() => commit(items.filter((it) => it.id !== item.id))}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 px-1 pt-1">
        <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) addItem();
          }}
          placeholder="添加检查项，回车创建"
          className="h-8 flex-1 bg-transparent text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200"
        />
      </div>
    </div>
  );
}