'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { TaskRow, type SubtaskCount } from './task-row';
import { cn } from '@/lib/utils';
import type { Tag, Task } from '@/lib/types';

export function SortableTaskRow({
  task,
  tags,
  subtaskCounts,
}: {
  task: Task;
  tags: Tag[];
  subtaskCounts: Map<string, SubtaskCount>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-70')}
    >
      <TaskRow
        task={task}
        tags={tags}
        subtaskCounts={subtaskCounts}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="拖动排序"
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