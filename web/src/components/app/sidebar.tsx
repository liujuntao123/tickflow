'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  GripVertical,
  Hash,
  Inbox,
  Layers,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDeleteFolder,
  useDeleteList,
  useDeleteTag,
  useFolders,
  useLists,
  useReorderLists,
  useTags,
  useUpdateFolder,
  useUpdateList,
  useUpdateTag,
} from '@/lib/hooks/use-org';
import { useViewCounts } from '@/lib/hooks/use-views';
import { logout } from '@/lib/hooks/use-auth';
import { useSession } from '@/lib/session';
import { cn, colorToHex, initialOf } from '@/lib/utils';
import { Button, Dropdown, IconButton, Input, MenuItem, Modal } from '@/components/ui';
import { ThemeSwitch } from './theme-switch';
import { CreateEntityModal, type CreateKind } from './create-entity-modal';
import type { Folder, Tag, TaskList } from '@/lib/types';

const SMART_ITEMS = [
  { key: 'inbox', href: '/inbox', label: '收件箱', icon: Inbox, countKey: 'inbox' as const },
  { key: 'today', href: '/today', label: '今天', icon: Sun, countKey: 'today' as const },
  { key: 'tomorrow', href: '/tomorrow', label: '明天', icon: CalendarDays, countKey: 'tomorrow' as const },
  { key: 'next7', href: '/next7', label: '未来 7 天', icon: CalendarRange, countKey: 'next7' as const },
  { key: 'all', href: '/all', label: '所有', icon: Layers, countKey: null },
  { key: 'completed', href: '/completed', label: '已完成', icon: CheckCircle2, countKey: null },
];

type EntityKind = 'folder' | 'list' | 'tag';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const clearSession = useSession((s) => s.clear);

  const { data: counts } = useViewCounts();
  const { data: folders = [] } = useFolders();
  const { data: lists = [] } = useLists();
  const { data: tags = [] } = useTags();

  const [modal, setModal] = useState<{ kind: CreateKind; folderId?: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ kind: EntityKind; id: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: EntityKind; id: string; name: string } | null>(null);

  const updateFolder = useUpdateFolder();
  const updateList = useUpdateList();
  const updateTag = useUpdateTag();
  const deleteFolder = useDeleteFolder();
  const deleteList = useDeleteList();
  const deleteTag = useDeleteTag();

  const regularLists = useMemo(() => lists.filter((l) => !l.isInbox), [lists]);
  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)),
    [folders],
  );
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)),
    [tags],
  );
  const sortedLists = (arr: TaskList[]) => [...arr].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

  const reorderLists = useReorderLists();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** 每个容器（文件夹 / 顶层）内的清单顺序，用于判断拖动是否落在同一容器。 */
  const listContainers = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const folder of sortedFolders) {
      map.set(
        folder.id,
        sortedLists(regularLists.filter((l) => l.folderId === folder.id)).map((l) => l.id),
      );
    }
    map.set('__root__', sortedLists(regularLists.filter((l) => !l.folderId)).map((l) => l.id));
    return map;
  }, [sortedFolders, regularLists]);

  function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    for (const ids of listContainers.values()) {
      if (!ids.includes(activeId) || !ids.includes(overId)) continue;
      reorderLists.mutate(arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId)));
      return;
    }
  }

  function toggleFolder(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commitRename(kind: EntityKind, id: string, name: string) {
    const trimmed = name.trim();
    setEditing(null);
    if (!trimmed) return;
    if (kind === 'folder') updateFolder.mutate({ id, name: trimmed });
    else if (kind === 'list') updateList.mutate({ id, name: trimmed });
    else updateTag.mutate({ id, name: trimmed });
  }

  async function handleDelete() {
    if (!confirm) return;
    const { kind, id } = confirm;
    setConfirm(null);
    if (kind === 'folder') await deleteFolder.mutateAsync({ id });
    else if (kind === 'list') await deleteList.mutateAsync(id);
    else await deleteTag.mutateAsync(id);
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* 忽略登出网络错误 */
    }
    clearSession();
    qc.clear();
    router.replace('/login');
  }

  const editingRow = (kind: EntityKind, id: string, name: string, className?: string) =>
    editing?.kind === kind && editing.id === id ? (
      <RenameInput defaultValue={name} onCommit={(v) => commitRename(kind, id, v)} onCancel={() => setEditing(null)} />
    ) : (
      <span className={cn('truncate', className)}>{name}</span>
    );

  const entityMenu = (kind: EntityKind, id: string, name: string, extra?: ReactNode) => (
    <Dropdown
      trigger={
        <IconButton className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="更多操作">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      }
    >
      {(close) => (
        <>
          {extra}
          <MenuItem
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => {
              setEditing({ kind, id });
              close();
            }}
          >
            重命名
          </MenuItem>
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" />}
            danger
            onClick={() => {
              setConfirm({ kind, id, name });
              close();
            }}
          >
            删除
          </MenuItem>
        </>
      )}
    </Dropdown>
  );

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* 用户区 */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[13px] font-semibold text-white">
          {initialOf(user?.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
            {user?.displayName ?? '未登录'}
          </p>
          <p className="truncate text-[11px] text-zinc-400">{user?.email}</p>
        </div>
        <Dropdown
          align="end"
          trigger={
            <IconButton aria-label="账号菜单">
              <Settings className="h-4 w-4" />
            </IconButton>
          }
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Settings className="h-3.5 w-3.5" />}
                onClick={() => {
                  router.push('/settings');
                  close();
                }}
              >
                设置
              </MenuItem>
              <MenuItem
                icon={<LogOut className="h-3.5 w-3.5" />}
                danger
                onClick={() => {
                  close();
                  handleLogout();
                }}
              >
                退出登录
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>

      {/* 搜索入口 */}
      <div className="px-3 pb-2">
        <Link
          href="/search"
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] transition-colors',
            pathname === '/search'
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
              : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300',
          )}
        >
          <Search className="h-4 w-4" />
          搜索
        </Link>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
        <nav className="tf-scroll flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {/* 智能清单 */}
        <ul className="space-y-0.5">
          {SMART_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const count = item.countKey ? counts?.[item.countKey] : undefined;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
                    active
                      ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-500' : 'text-zinc-400')} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px] tabular-nums',
                        active ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-zinc-400',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* 文件夹 / 清单 */}
        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">清单</span>
            <Dropdown
              align="end"
              trigger={
                <IconButton aria-label="新建">
                  <Plus className="h-4 w-4" />
                </IconButton>
              }
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Hash className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setModal({ kind: 'list' });
                      close();
                    }}
                  >
                    新建清单
                  </MenuItem>
                  <MenuItem
                    icon={<FolderIcon className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setModal({ kind: 'folder' });
                      close();
                    }}
                  >
                    新建文件夹
                  </MenuItem>
                </>
              )}
            </Dropdown>
          </div>

          <ul className="space-y-0.5">
            {sortedFolders.map((folder: Folder) => {
              const isCollapsed = collapsed.has(folder.id);
              const children = sortedLists(regularLists.filter((l) => l.folderId === folder.id));
              return (
                <li key={folder.id}>
                  <div className="group flex h-8 items-center gap-1 rounded-lg px-1.5 text-[13px] text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <button
                      type="button"
                      aria-label={isCollapsed ? '展开' : '折叠'}
                      onClick={() => toggleFolder(folder.id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400"
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <FolderIcon className="h-4 w-4 shrink-0" style={{ color: colorToHex(folder.color) }} />
                    <div className="flex min-w-0 flex-1 items-center">
                      {editingRow('folder', folder.id, folder.name, 'font-medium')}
                    </div>
                    {entityMenu('folder', folder.id, folder.name, (
                      <MenuItem
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => setModal({ kind: 'list', folderId: folder.id })}
                      >
                        在此新建清单
                      </MenuItem>
                    ))}
                  </div>

                  {!isCollapsed && (
                    <ul className="ml-3 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                      <SortableContext items={children.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        {children.map((list) => (
                          <li key={list.id}>
                            <SortableListRow
                              list={list}
                              active={pathname === `/list/${list.id}`}
                              editing={editing?.kind === 'list' && editing.id === list.id}
                              onCommitRename={(v) => commitRename('list', list.id, v)}
                              onCancelRename={() => setEditing(null)}
                              menu={entityMenu('list', list.id, list.name)}
                              onStartRename={() => setEditing({ kind: 'list', id: list.id })}
                            />
                          </li>
                        ))}
                      </SortableContext>
                      {children.length === 0 && (
                        <li className="px-3 py-1 text-[12px] text-zinc-300 dark:text-zinc-600">空</li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}

            <SortableContext
              items={sortedLists(regularLists.filter((l) => !l.folderId)).map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedLists(regularLists.filter((l) => !l.folderId)).map((list) => (
                <li key={list.id}>
                  <SortableListRow
                    list={list}
                    active={pathname === `/list/${list.id}`}
                    editing={editing?.kind === 'list' && editing.id === list.id}
                    onCommitRename={(v) => commitRename('list', list.id, v)}
                    onCancelRename={() => setEditing(null)}
                    menu={entityMenu('list', list.id, list.name)}
                    onStartRename={() => setEditing({ kind: 'list', id: list.id })}
                  />
                </li>
              ))}
            </SortableContext>
          </ul>
        </div>

        {/* 标签 */}
        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">标签</span>
            <IconButton aria-label="新建标签" onClick={() => setModal({ kind: 'tag' })}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
          <ul className="space-y-0.5">
            {sortedTags.map((tag: Tag) => {
              const active = pathname === `/tag/${tag.id}`;
              return (
                <li key={tag.id}>
                  <div
                    className={cn(
                      'group flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px]',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    <Hash className="h-4 w-4 shrink-0" style={{ color: colorToHex(tag.color) }} />
                    {editing?.kind === 'tag' && editing.id === tag.id ? (
                      <RenameInput
                        defaultValue={tag.name}
                        onCommit={(v) => commitRename('tag', tag.id, v)}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <Link href={`/tag/${tag.id}`} className="min-w-0 flex-1 truncate">
                        {tag.name}
                      </Link>
                    )}
                    {entityMenu('tag', tag.id, tag.name)}
                  </div>
                </li>
              );
            })}
            {sortedTags.length === 0 && (
              <li className="px-3 py-1 text-[12px] text-zinc-300 dark:text-zinc-600">暂无标签</li>
            )}
          </ul>
        </div>
      </nav>
      </DndContext>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <ThemeSwitch />
      </div>

      {modal && (
        <CreateEntityModal kind={modal.kind} folderId={modal.folderId} onClose={() => setModal(null)} />
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="确认删除"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          确定删除「{confirm?.name}」吗？
          {confirm?.kind === 'list' && '其中的任务将移入收件箱。'}
          {confirm?.kind === 'folder' && '文件夹内的清单将移至顶层。'}
          {confirm?.kind === 'tag' && '任务上的该标签关联将被清除。'}
        </p>
      </Modal>
    </aside>
  );
}

type ListRowProps = {
  list: TaskList;
  active: boolean;
  editing: boolean;
  menu: ReactNode;
  onStartRename: () => void;
  onCommitRename: (v: string) => void;
  onCancelRename: () => void;
};

function SortableListRow(props: ListRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.list.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-70')}
    >
      <ListRow
        {...props}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label="拖动排序"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="-ml-1.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:text-zinc-500 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        }
      />
    </div>
  );
}

function ListRow({
  list,
  active,
  editing,
  menu,
  dragHandle,
  onStartRename,
  onCommitRename,
  onCancelRename,
}: ListRowProps & { dragHandle?: ReactNode }) {
  return (
    <div
      className={cn(
        'group flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px]',
        active
          ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
      )}
    >
      {dragHandle}
      <Hash className="h-4 w-4 shrink-0" style={{ color: colorToHex(list.color) }} />
      {editing ? (
        <RenameInput defaultValue={list.name} onCommit={onCommitRename} onCancel={onCancelRename} />
      ) : (
        <Link
          href={`/list/${list.id}`}
          className="min-w-0 flex-1 truncate"
          onDoubleClick={(e) => {
            e.preventDefault();
            onStartRename();
          }}
        >
          {list.name}
          {list._count?.tasks ? <span className="ml-1.5 text-[11px] text-zinc-400">{list._count.tasks}</span> : null}
        </Link>
      )}
      {menu}
    </div>
  );
}

function RenameInput({
  defaultValue,
  onCommit,
  onCancel,
}: {
  defaultValue: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
        if (e.key === 'Escape') onCancel();
      }}
      className="h-6 flex-1 rounded-md px-1.5 text-[13px]"
    />
  );
}