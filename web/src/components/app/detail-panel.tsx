'use client';

import { useEffect, type ReactNode } from 'react';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { TaskDetail } from './task-detail';

/**
 * 右侧任务详情：≥1024px 常驻栏，窄屏为浮层抽屉（遮罩 / ESC 收起）。
 * `empty` 用于未选中任务时展示的内容（列表页提示、日历页的当天任务等）。
 */
export function DetailPanel({ empty }: { empty: ReactNode }) {
  const detailOpen = useUiStore((s) => s.detailOpen);
  const setDetailOpen = useUiStore((s) => s.setDetailOpen);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) return;
      setDetailOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailOpen, setDetailOpen]);

  if (!detailOpen) return null;

  return (
    <>
      {selectedTaskId && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDetailOpen(false)}
          aria-hidden
        />
      )}
      <aside
        role="dialog"
        aria-label="任务详情"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-[88vw] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200 ease-out',
          'dark:border-zinc-800 dark:bg-zinc-900',
          selectedTaskId ? 'translate-x-0' : 'translate-x-full invisible pointer-events-none lg:visible lg:pointer-events-auto',
          'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shrink-0 lg:shadow-none lg:transition-none',
        )}
      >
        {selectedTaskId ? <TaskDetail key={selectedTaskId} taskId={selectedTaskId} /> : empty}
      </aside>
    </>
  );
}