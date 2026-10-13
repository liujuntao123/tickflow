'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Hash, Search as SearchIcon } from 'lucide-react';
import { useSearch } from '@/lib/hooks/use-search';
import { useUiStore } from '@/lib/ui-store';
import { EmptyState, Spinner } from '@/components/ui';
import type { SearchResult } from '@/lib/types';

const TYPE_META: Record<string, { label: string; icon: typeof Hash }> = {
  task: { label: '任务', icon: CheckSquare },
  list: { label: '清单', icon: Hash },
  tag: { label: '标签', icon: Hash },
};

export default function SearchPage() {
  const router = useRouter();
  const selectTask = useUiStore((s) => s.selectTask);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useSearch(debounced);
  const results = data?.results ?? [];

  const groups = useMemo(() => {
    const order = ['task', 'list', 'tag'];
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return order.filter((t) => map.has(t)).map((t) => ({ type: t, items: map.get(t)! }));
  }, [results]);

  function open(result: SearchResult) {
    if (result.type === 'task') {
      selectTask(result.id);
      router.push('/all');
    } else if (result.type === 'list') {
      router.push(`/list/${result.id}`);
    } else if (result.type === 'tag') {
      router.push(`/tag/${result.id}`);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
            <SearchIcon className="h-4 w-4 text-zinc-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索任务、清单、标签…"
              className="h-full flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            {isFetching && <Spinner className="h-4 w-4" />}
          </div>
        </div>
      </header>

      <div className="tf-scroll flex-1 overflow-y-auto px-5 py-4">
        {debounced.trim().length === 0 ? (
          <EmptyState
            icon={<SearchIcon className="h-8 w-8" />}
            title="搜索你的所有内容"
            description="输入关键词即可跨任务、清单与标签检索。"
          />
        ) : groups.length === 0 && !isFetching ? (
          <EmptyState
            icon={<SearchIcon className="h-8 w-8" />}
            title="没有找到结果"
            description={`未找到与「${debounced}」相关的内容，试试其他关键词。`}
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            {groups.map((group) => {
              const meta = TYPE_META[group.type] ?? { label: group.type, icon: Hash };
              const Icon = meta.icon;
              return (
                <div key={group.type}>
                  <div className="mb-1.5 flex items-center gap-2 px-1">
                    <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[12px] font-semibold text-zinc-400">{meta.label}</span>
                    <span className="text-[11px] tabular-nums text-zinc-300 dark:text-zinc-600">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    {group.items.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => open(item)}
                        className="flex w-full items-center gap-3 border-b border-zinc-100 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/50"
                      >
                        <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-800 dark:text-zinc-100">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="shrink-0 truncate text-[12px] text-zinc-400">{item.subtitle}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}