'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import {
  CalendarClock,
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
import { useTasksByFolder, useTasksByList, useTasksByTag } from '@/lib/hooks/use-tasks';
import { useUiStore } from '@/lib/ui-store';
import { groupTasks } from '@/lib/grouping';
import { SMART_LIST_LABELS, type SmartListKey } from '@/lib/constants';
import { cn, endOfDayIso } from '@/lib/utils';
import { Dropdown, EmptyState, IconButton, MenuItem, Spinner } from '@/components/ui';
import { TaskRow } from './task-row';
import { QuickAdd } from './quick-add';
import { TaskDetail } from './task-detail';
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
  const setDetailOpen = useUiStore((s) => s.setDetailOpen);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);

  // 窄屏抽屉：ESC 关闭（输入控件内按 ESC 不触发）
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

  const { data: lists = [] } = useLists();
  const { data: tags = [] } = useTags();

  const groups = useMemo(() => groupTasks(tasks, groupBy, lists), [tasks, groupBy, lists]);
  const suppressTitle = hideSingleGroupTitle && groupBy === 'list';

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
            {subtitle && <span className="truncate text-[12px] text-zinc-400">{subtitle}</span>}
            <span className="text-[13px] tabular-nums text-zinc-400">{tasks.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
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

        <div className="tf-scroll flex-1 overflow-y-auto px-5 py-3">
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
            <div className="pb-2">
              {groups.map((group) => (
                <div key={group.key} className="mb-4">
                  {!suppressTitle && (
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <span className="text-[12px] font-semibold text-zinc-400">{group.label}</span>
                      <span className="text-[11px] tabular-nums text-zinc-300 dark:text-zinc-600">
                        {group.tasks.length}
                      </span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {group.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} tags={tags} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!hideQuickAdd && !isLoading && groups.length > 0 && (
          <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <QuickAdd listId={defaultListId} defaultDue={defaultDue} placeholder="继续添加任务…" />
          </div>
        )}
      </section>

      {detailOpen && (
        <>
          {/* 窄屏遮罩：点击收起抽屉（lg 及以上隐藏） */}
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
              // 窄屏：右侧浮层抽屉
              'fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-[88vw] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200 ease-out',
              'dark:border-zinc-800 dark:bg-zinc-900',
              selectedTaskId
                ? 'translate-x-0'
                : 'translate-x-full invisible pointer-events-none lg:visible lg:pointer-events-auto',
              // ≥1024px：恢复常驻三栏
              'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shrink-0 lg:shadow-none lg:transition-none',
            )}
          >
            {selectedTaskId ? (
              <TaskDetail key={selectedTaskId} taskId={selectedTaskId} />
            ) : (
              <EmptyState
                icon={<Search className="h-7 w-7" />}
                title="选择任务查看详情"
                description="点击左侧任意任务，在这里编辑标题、备注、优先级、截止时间、标签与子任务。"
              />
            )}
          </aside>
        </>
      )}
    </div>
  );
}