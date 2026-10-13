'use client';

import { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, LayoutGrid } from 'lucide-react';
import { useView } from '@/lib/hooks/use-views';
import { useSubtaskCounts, useUpdateTask } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-org';
import { useToast } from '@/lib/toast';
import { QUADRANT_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/ui';
import { TaskRow, type SubtaskCount } from './task-row';
import { DetailPanel } from './detail-panel';
import type { Tag, Task } from '@/lib/types';

const QUADRANTS: { key: string; important: boolean }[] = [
  { key: 'q1', important: true },
  { key: 'q2', important: true },
  { key: 'q3', important: false },
  { key: 'q4', important: false },
];

const QUADRANT_HINT: Record<string, string> = {
  q1: '立刻去做',
  q2: '安排时间去做',
  q3: '尽快处理或授权',
  q4: '尽量少做',
};

export function MatrixWorkspace() {
  const { data: view, isLoading, isError } = useView('matrix', 'quadrant');
  const subtaskCounts = useSubtaskCounts();
  const { data: tags = [] } = useTags();
  const updateTask = useUpdateTask();
  const push = useToast((s) => s.push);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byQuadrant = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const group of view?.groups ?? []) map.set(group.key, group.tasks);
    return map;
  }, [view?.groups]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetKey = String(over.id);
    const target = QUADRANTS.find((q) => q.key === targetKey);
    if (!target) return;
    const task = (view?.groups ?? []).flatMap((g) => g.tasks).find((t) => t.id === String(active.id));
    if (!task) return;
    const currentlyImportant = task.priority === 3 || task.priority === 5;
    if (currentlyImportant === target.important) return;
    updateTask.mutate({ id: task.id, priority: target.important ? 5 : 1 });
    push(`已设为${target.important ? '高' : '低'}优先级`, 'success');
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-[13px] text-zinc-400">
        四象限加载失败，请稍后重试
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-brand-500" />
              <h1 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">四象限</h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUADRANTS.map((q) => (
                <span
                  key={q.key}
                  className="rounded-lg bg-white px-2.5 py-1 text-[12px] text-zinc-500 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800"
                >
                  {QUADRANT_LABELS[q.key]}
                  <span className="ml-1.5 tabular-nums text-zinc-400">{byQuadrant.get(q.key)?.length ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12px] text-zinc-400">
            拖拽到不同象限只调整优先级：重要 → 高（P5），不重要 → 低（P1）；紧急由截止时间（≤ 明天结束）自动推导。
          </p>
        </header>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="tf-scroll grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
            {QUADRANTS.map((q) => (
              <Quadrant
                key={q.key}
                id={q.key}
                label={QUADRANT_LABELS[q.key]}
                hint={QUADRANT_HINT[q.key]}
                tasks={byQuadrant.get(q.key) ?? []}
                tags={tags}
                subtaskCounts={subtaskCounts}
              />
            ))}
          </div>
        </DndContext>
      </section>

      <DetailPanel
        empty={
          <div className="flex h-full flex-col">
            <EmptyState
              icon={<LayoutGrid className="h-7 w-7" />}
              title="选择任务查看详情"
              description="点击任意象限中的任务即可在此编辑；拖动任务可调整优先级，从而在象限间移动。"
            />
            <div className="mx-4 mb-4 rounded-xl bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">象限规则</p>
              <p>重要：优先级为中 / 高（P3、P5）</p>
              <p>紧急：截止时间 ≤ 明天结束</p>
            </div>
          </div>
        }
      />
    </div>
  );
}

function Quadrant({
  id,
  label,
  hint,
  tasks,
  tags,
  subtaskCounts,
}: {
  id: string;
  label: string;
  hint: string;
  tasks: Task[];
  tags: Tag[];
  subtaskCounts: Map<string, SubtaskCount>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[220px] flex-col rounded-2xl border bg-white transition-colors dark:bg-zinc-900',
        isOver
          ? 'border-brand-400 ring-2 ring-brand-400/40 dark:border-brand-500'
          : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">{label}</h2>
          <span className="text-[11px] tabular-nums text-zinc-400">{tasks.length}</span>
        </div>
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600">{hint}</span>
      </div>
      <div className="flex-1 space-y-0.5 p-2">
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-zinc-300 dark:text-zinc-600">
            把任务拖到这里，或为任务设置优先级 / 截止时间
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableTask key={task.id} task={task} tags={tags} subtaskCounts={subtaskCounts} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableTask({
  task,
  tags,
  subtaskCounts,
}: {
  task: Task;
  tags: Tag[];
  subtaskCounts: Map<string, SubtaskCount>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(isDragging && 'relative z-20 opacity-70')}
    >
      <TaskRow
        task={task}
        tags={tags}
        subtaskCounts={subtaskCounts}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="拖动调整象限"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="-ml-1 mt-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:text-zinc-500 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}