'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Inbox,
  Layers,
  ListFilter,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Tag as TagIcon,
} from 'lucide-react';
import { useLists, useTags, useFolders } from '@/lib/hooks/use-org';
import { useView } from '@/lib/hooks/use-views';
import {
  useReorderTasks,
  useSubtaskCounts,
  useTasksByFolder,
  useTasksByList,
  useTasksByTag,
} from '@/lib/hooks/use-tasks';
import { useUiStore } from '@/lib/ui-store';
import { groupTasks } from '@/lib/grouping';
import { SMART_LIST_LABELS, type SmartListKey } from '@/lib/constants';
import { cn, colorToHex, endOfDayIso } from '@/lib/utils';
import { Dropdown, EmptyState, IconButton, MenuItem, Spinner } from '@/components/ui';
import { TaskRow } from './task-row';
import { SortableTaskRow } from './sortable-task-row';
import { QuickAdd } from './quick-add';
import { DetailPanel } from './detail-panel';
import type { GroupBy, Task } from '@/lib/types';

export type ViewSource =
  | { kind: 'smart'; key: SmartListKey }
  | { kind: 'list'; id: string }
  | { kind: 'tag'; id: string }
  | { kind: 'folder'; id: string };

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'list', label: '按清单' },
  { value: 'date', label: '按日期' },
  { value: 'priority', label: '按优先级' },
  { value: 'quadrant', label: '按四象限' },
];

export function TaskWorkspace({ source }: { source: ViewSource }) {
  if (source.kind === 'smart') return <SmartWorkspace viewKey={source.key} />;
  if (source.kind === 'list') return <ListWorkspace listId={source.id} />;
  if (source.kind === 'tag') return <TagWorkspace tagId={source.id} />;
  return <FolderWorkspace folderId={source.id} />;
}

/* --------------------------------- 智能清单 --------------------------------- */

function SmartWorkspace({ viewKey }: { viewKey: SmartListKey }) {
  const { data, isLoading, isError } = useView(viewKey, 'list');
  const tasks = useMemo(() => (data?.groups ?? []).flatMap((g) => g.tasks), [data]);
  const defaultDue =
    viewKey === 'today' ? endOfDayIso(0) : viewKey === 'tomorrow' ? endOfDayIso(1) : null;

  return (
    <Shell
      title={SMART_LIST_LABELS[viewKey]}
      tasks={tasks}
      isLoading={isLoading}
      isError={isError}
      defaultDue={defaultDue}
      hideQuickAdd={viewKey === 'completed'}
      emptyIcon={<IconForView viewKey={viewKey} />}
      emptyTitle={EMPTY_TITLE[viewKey]}
      emptyDesc={EMPTY_DESC[viewKey]}
    />
  );
}

/* ---------------------------------- 清单 ----------------------------------- */

function ListWorkspace({ listId }: { listId: string }) {
  const { data: lists = [] } = useLists();
  const { data: folders = [] } = useFolders();
  const { data: tasks = [], isLoading, isError } = useTasksByList(listId);
  const list = lists.find((l) => l.id === listId);
  const folder = folders.find((f) => f.id === list?.folderId);

  return (
    <Shell
      title={list?.name ?? '清单'}
      subtitle={folder?.name}
      tasks={tasks}
      isLoading={isLoading}
      isError={isError}
      defaultListId={listId}
      hideSingleGroupTitle
      emptyIcon={<Inbox className="h-8 w-8" />}
      emptyTitle="这个清单还是空的"
      emptyDesc="在下方输入框添加第一个任务，用「今天」「明天」可快速设置截止时间。"
    />
  );
}

/* ---------------------------------- 标签 ----------------------------------- */

function TagWorkspace({ tagId }: { tagId: string }) {
  const { data: tags = [] } = useTags();
  const { data: tasks = [], isLoading, isError } = useTasksByTag(tagId);
  const tag = tags.find((t) => t.id === tagId);

  return (
    <Shell
      title={`# ${tag?.name ?? '标签'}`}
      tasks={tasks}
      isLoading={isLoading}
      isError={isError}
      hideSingleGroupTitle
      emptyIcon={<TagIcon className="h-8 w-8" />}
      emptyTitle="暂无带此标签的任务"
      emptyDesc="在任务详情中为其添加该标签即可在这里看到。"
    />
  );
}

/* --------------------------------- 文件夹 ---------------------------------- */

function FolderWorkspace({ folderId }: { folderId: string }) {
  const { data: folders = [] } = useFolders();
  const { data: tasks = [], isLoading, isError } = useTasksByFolder(folderId);
  const folder = folders.find((f) => f.id === folderId);

  return (
    <Shell
      title={folder?.name ?? '文件夹'}
      tasks={tasks}
      isLoading={isLoading}
      isError={isError}
      emptyIcon={<Layers className="h-8 w-8" />}
      emptyTitle="文件夹内暂无任务"
      emptyDesc="创建一个清单并在其中添加任务，任务会汇总到这里。"
    />
  );
}

/* --------------------------------- 外壳 ------------------------------------ */

const EMPTY_TITLE: Record<SmartListKey, string> = {
  inbox: '收件箱已清空',
  today: '今天没有任务',
  tomorrow: '明天暂无安排',
  next7: '未来 7 天暂无任务',
  all: '还没有任务',
  completed: '还没有完成的任务',
};

const EMPTY_DESC: Record<SmartListKey, string> = {
  inbox: '所有新任务都会先落到这里，随时整理到各个清单。',
  today: '享受这一刻，或者为今天添加一个任务。',
  tomorrow: '提前规划，让明天更从容。',
  next7: '接下来一周都很轻松。',
  all: '在左侧选择一个清单，然后添加你的第一个任务。',
  completed: '完成任务后会自动出现在这里。',
};

function IconForView({ viewKey }: { viewKey: SmartListKey }) {
  if (viewKey === 'completed') return <CheckCircle2 className="h-8 w-8" />;
  if (viewKey === 'today' || viewKey === 'tomorrow' || viewKey === 'next7')
    return <CalendarClock className="h-8 w-8" />;
  if (viewKey === 'all') return <Layers className="h-8 w-8" />;
  return <Inbox className="h-8 w-8" />;
}

function Shell({
  title,
  subtitle,
  tasks,
  isLoading,
  isError,
  defaultListId,
  defaultDue,
  hideQuickAdd,
  hideSingleGroupTitle,
  emptyIcon,
  emptyTitle,
  emptyDesc,
}: {
  title: string;
  subtitle?: string;
  tasks: Task[];
  isLoading: boolean;
  isError: boolean;
  defaultListId?: string | null;
  defaultDue?: string | null;
  hideQuickAdd?: boolean;
  hideSingleGroupTitle?: boolean;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDesc: string;
}) {
  const groupBy = useUiStore((s) => s.groupBy);
  const setGroupBy = useUiStore((s) => s.setGroupBy);
  const detailOpen = useUiStore((s) => s.detailOpen);
  const toggleDetail = useUiStore((s) => s.toggleDetail);

  const { data: lists = [] } = useLists();
  const { data: tags = [] } = useTags();
  const subtaskCounts = useSubtaskCounts();
  const reorder = useReorderTasks();

  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const visibleTasks = useMemo(
    () => (tagFilter.length === 0 ? tasks : tasks.filter((t) => (t.tagIds ?? []).some((id) => tagFilter.includes(id)))),
    [tasks, tagFilter],
  );
  const groups = useMemo(() => groupTasks(visibleTasks, groupBy, lists), [visibleTasks, groupBy, lists]);
  const suppressTitle = hideSingleGroupTitle && groupBy === 'list';
  const canDrag = groupBy === 'list';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const group = groups.find((g) => g.tasks.some((t) => t.id === active.id));
    if (!group) return;
    const ids = group.tasks.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const listId = group.tasks[from]?.listId;
    if (!listId) return;
    reorder.mutate({ listId, orderedIds: arrayMove(ids, from, to) });
  }

  const renderRow = (task: Task) =>
    canDrag ? (
      <SortableTaskRow key={task.id} task={task} tags={tags} subtaskCounts={subtaskCounts} />
    ) : (
      <TaskRow key={task.id} task={task} tags={tags} subtaskCounts={subtaskCounts} />
    );

  const grouped = (
    <div className="pb-2">
      {groups.map((group) => (
        <div key={group.key} className="tf-cv-group mb-4">
          {!suppressTitle && (
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className="text-[12px] font-semibold text-zinc-400">{group.label}</span>
              <span className="text-[11px] tabular-nums text-zinc-300 dark:text-zinc-600">{group.tasks.length}</span>
            </div>
          )}
          {canDrag ? (
            <SortableContext items={group.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">{group.tasks.map(renderRow)}</div>
            </SortableContext>
          ) : (
            <div className="space-y-0.5">{group.tasks.map(renderRow)}</div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
            {subtitle && <span className="truncate text-[12px] text-zinc-400">{subtitle}</span>}
            <span className="text-[13px] tabular-nums text-zinc-400">
              {tagFilter.length > 0 ? `${visibleTasks.length}/${tasks.length}` : tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dropdown
              trigger={
                <button
                  type="button"
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] transition-colors',
                    tagFilter.length > 0
                      ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800',
                  )}
                >
                  <TagIcon className="h-3.5 w-3.5" />
                  标签{tagFilter.length > 0 ? ` · ${tagFilter.length}` : ''}
                </button>
              }
            >
              {tags.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[12px] text-zinc-400">暂无标签</p>
              ) : (
                <>
                  {tags.map((tag) => {
                    const active = tagFilter.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setTagFilter((prev) => (active ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]))
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorToHex(tag.color) }} />
                        <span className="flex-1 truncate">{tag.name}</span>
                        {active && <Check className="h-3.5 w-3.5 text-brand-500" />}
                      </button>
                    );
                  })}
                  {tagFilter.length > 0 && (
                    <MenuItem onClick={() => setTagFilter([])}>清除筛选</MenuItem>
                  )}
                </>
              )}
            </Dropdown>
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-[12px] text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
                </button>
              }
            >
              {(close) => (
                <>
                  {GROUP_BY_OPTIONS.map((o) => (
                    <MenuItem
                      key={o.value}
                      onClick={() => {
                        setGroupBy(o.value);
                        close();
                      }}
                    >
                      {o.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Dropdown>
            <IconButton aria-label="展开/收起详情" onClick={toggleDetail}>
              {detailOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </IconButton>
          </div>
        </header>

        {!hideQuickAdd && (
          <div className="px-5 pt-3">
            <QuickAdd listId={defaultListId} defaultDue={defaultDue} />
          </div>
        )}

        <div className={cn('tf-scroll flex-1 overflow-y-auto px-5 py-3', dragging && 'tf-dragging')}>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          ) : isError ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[13px] text-zinc-400">
              <p>加载失败，请稍后重试</p>
            </div>
          ) : groups.length === 0 ? (
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => setDragging(true)}
              onDragCancel={() => setDragging(false)}
              onDragEnd={(event) => {
                setDragging(false);
                handleDragEnd(event);
              }}
            >
              {grouped}
            </DndContext>
          )}
        </div>

        {!hideQuickAdd && !isLoading && groups.length > 0 && (
          <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <QuickAdd listId={defaultListId} defaultDue={defaultDue} placeholder="继续添加任务…" />
          </div>
        )}
      </section>

      <DetailPanel
        empty={
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="选择任务查看详情"
            description="点击左侧任意任务，在这里编辑标题、备注、优先级、截止时间、标签与子任务。"
          />
        }
      />
    </div>
  );
}