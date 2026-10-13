'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Check, Circle, Repeat, Trash2, X } from 'lucide-react';
import {
  useCreateTask,
  useDeleteTask,
  useSubtaskCounts,
  useTask,
  useToggleTask,
  useUpdateTask,
  type UpdateTaskInput,
} from '@/lib/hooks/use-tasks';
import { useLists, useTags } from '@/lib/hooks/use-org';
import { useUiStore } from '@/lib/ui-store';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_OPTIONS, TASK_STATUS } from '@/lib/constants';
import { buildRRule, parseRRule, type RepeatConfig } from '@/lib/rrule';
import { cn, colorToHex, endOfDayIso, fromDatetimeLocal, nextWeekIso, toDatetimeLocal } from '@/lib/utils';
import { Button, Dropdown, IconButton, Input, Spinner } from '@/components/ui';
import { RepeatPicker } from './repeat-picker';
import { ReminderPicker } from './reminder-picker';
import { ChecklistEditor } from './checklist-editor';

const RichTextEditor = dynamic(() => import('./rich-text-editor'), {
  ssr: false,
  loading: () => (
    <div className="h-[110px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40" />
  ),
});

export function TaskDetail({ taskId }: { taskId: string }) {
  const { data: task, isLoading } = useTask(taskId);
  const { data: lists = [] } = useLists();
  const { data: tags = [] } = useTags();
  const subtaskCounts = useSubtaskCounts();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toggle = useToggleTask();
  const create = useCreateTask();
  const selectTask = useUiStore((s) => s.selectTask);
  const setDetailOpen = useUiStore((s) => s.setDetailOpen);

  const [title, setTitle] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');

  // 备注：编辑器自持内容，本地防抖提交，避免逐字 PATCH
  const notesRef = useRef('');
  const savedNotesRef = useRef('');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(task?.title ?? '');
  }, [task?.id, task?.title]);

  useEffect(() => {
    notesRef.current = task?.notes ?? '';
    savedNotesRef.current = task?.notes ?? '';
  }, [task?.id]);

  useEffect(() => {
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, []);

  const repeatValue: RepeatConfig = useMemo(() => {
    const cfg = parseRRule(task?.recurrenceRule);
    return { ...cfg, repeatFrom: task?.repeatFrom === 1 ? 1 : 0 };
  }, [task?.recurrenceRule, task?.repeatFrom]);

  if (isLoading || !task) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const completed = task.status === TASK_STATUS.COMPLETED;
  const tagIds = task.tagIds ?? [];
  const subtasks = task.subtasks ?? [];
  const childStat = subtaskCounts.get(task.id);

  const commit = (patch: UpdateTaskInput) => update.mutate(patch);

  function toggleTag(id: string) {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    commit({ id: task!.id, tagIds: next });
  }

  function addSubtask() {
    const t = subtaskTitle.trim();
    if (!t) return;
    setSubtaskTitle('');
    create.mutate({ title: t, parentId: task!.id, listId: task!.listId });
  }

  function handleNotesChange(markdown: string) {
    notesRef.current = markdown;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      if (notesRef.current === savedNotesRef.current) return;
      savedNotesRef.current = notesRef.current;
      update.mutate({ id: taskId, notes: notesRef.current || null });
    }, 800);
  }

  function applyRepeat(cfg: RepeatConfig) {
    const rule = buildRRule(cfg);
    commit({
      id: task!.id,
      recurrenceRule: rule,
      repeatFrom: cfg.repeatFrom,
      recurrenceDtstart: rule ? (task!.dueDate ?? new Date().toISOString()) : null,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="切换完成状态"
            onClick={() => toggle.mutate({ id: task.id, completed: !completed })}
            className={cn('transition-colors', completed ? 'text-brand-500' : 'text-zinc-300 hover:text-brand-500')}
          >
            {completed ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
          </button>
          <span className="text-[13px] font-medium text-zinc-400">{completed ? '已完成' : '待办'}</span>
          {task.recurrenceRule && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Repeat className="h-3 w-3" />
              重复
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="删除任务"
            onClick={() => {
              remove.mutate(task.id);
              selectTask(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton aria-label="收起详情" onClick={() => setDetailOpen(false)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="tf-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* 标题 */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const v = title.trim();
            if (v && v !== task.title) commit({ id: task.id, title: v });
            else if (!v) setTitle(task.title);
          }}
          className={cn(
            'w-full bg-transparent text-lg font-semibold text-zinc-900 placeholder:text-zinc-300 focus:outline-none dark:text-zinc-50',
            completed && 'text-zinc-400 line-through',
          )}
          placeholder="任务标题"
        />

        {/* 备注（Markdown 富文本） */}
        <Section label="备注">
          <RichTextEditor value={task.notes ?? ''} onChange={handleNotesChange} />
        </Section>

        {/* 优先级 */}
        <Section label="优先级">
          <div className="flex gap-1.5">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => commit({ id: task.id, priority: p })}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
                  task.priority === p
                    ? 'border-transparent text-white'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800',
                )}
                style={task.priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : undefined}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </Section>

        {/* 截止时间 */}
        <Section label="截止时间">
          <div className="space-y-2">
            <Input
              type="datetime-local"
              value={toDatetimeLocal(task.dueDate ? new Date(task.dueDate) : null)}
              onChange={(e) => commit({ id: task.id, dueDate: fromDatetimeLocal(e.target.value) })}
              className="h-9"
            />
            <div className="flex flex-wrap gap-1.5">
              <QuickChip onClick={() => commit({ id: task.id, dueDate: endOfDayIso(0) })}>今天</QuickChip>
              <QuickChip onClick={() => commit({ id: task.id, dueDate: endOfDayIso(1) })}>明天</QuickChip>
              <QuickChip onClick={() => commit({ id: task.id, dueDate: nextWeekIso() })}>下周</QuickChip>
              {task.dueDate && <QuickChip onClick={() => commit({ id: task.id, dueDate: null })}>清除</QuickChip>}
            </div>
          </div>
        </Section>

        {/* 重复 */}
        <Section label="重复">
          <RepeatPicker value={repeatValue} onChange={applyRepeat} />
        </Section>

        {/* 提醒 */}
        <Section label="提醒">
          <ReminderPicker
            value={(task.reminders ?? []).map((r) => r.offset)}
            onChange={(offsets) =>
              commit({ id: task.id, reminders: offsets.length ? offsets.map((offset) => ({ offset })) : null })
            }
          />
        </Section>

        {/* 所属清单 */}
        <Section label="所属清单">
          <select
            value={task.listId}
            onChange={(e) => commit({ id: task.id, listId: e.target.value })}
            className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 focus:border-brand-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Section>

        {/* 标签 */}
        <Section label="标签">
          <div className="flex flex-wrap items-center gap-1.5">
            {tagIds.length === 0 && <span className="text-[12px] text-zinc-300">未添加</span>}
            {tagIds.map((id) => {
              const tag = tags.find((t) => t.id === id);
              if (!tag) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[12px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorToHex(tag.color) }} />
                  {tag.name}
                  <button
                    type="button"
                    aria-label="移除标签"
                    onClick={() => toggleTag(id)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <Dropdown
              align="start"
              trigger={
                <button
                  type="button"
                  className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-[12px] text-zinc-400 hover:border-brand-400 hover:text-brand-500 dark:border-zinc-700"
                >
                  + 标签
                </button>
              }
            >
              {tags.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[12px] text-zinc-400">暂无标签，请在左侧创建</p>
              ) : (
                tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorToHex(tag.color) }} />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {tagIds.includes(tag.id) && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  </button>
                ))
              )}
            </Dropdown>
          </div>
        </Section>

        {/* 检查项 */}
        <Section label="检查项">
          <ChecklistEditor taskId={task.id} checklist={task.checklist} />
        </Section>

        {/* 子任务 */}
        <Section
          label={`子任务${childStat ? ` · ${childStat.done}/${childStat.total}` : ''}`}
        >
          <div className="space-y-1">
            {subtasks.map((st) => {
              const done = st.status === TASK_STATUS.COMPLETED;
              return (
                <div
                  key={st.id}
                  className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <button
                    type="button"
                    aria-label="切换子任务"
                    onClick={() => toggle.mutate({ id: st.id, completed: !done })}
                    className={cn('shrink-0', done ? 'text-brand-500' : 'text-zinc-300 hover:text-brand-500')}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <span
                    className={cn(
                      'flex-1 truncate text-[13px]',
                      done ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200',
                    )}
                  >
                    {st.title}
                  </span>
                  <IconButton
                    aria-label="删除子任务"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => remove.mutate(st.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-1 pt-1">
              <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) addSubtask();
                }}
                placeholder="添加子任务，回车创建"
                className="h-8 flex-1 bg-transparent text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200"
              />
            </div>
          </div>
        </Section>
      </div>

      <footer className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-zinc-500 hover:text-red-600"
          onClick={() => {
            remove.mutate(task.id);
            selectTask(null);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除任务
        </Button>
      </footer>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      {children}
    </div>
  );
}

function QuickChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-zinc-100 px-2 py-1 text-[12px] text-zinc-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
    >
      {children}
    </button>
  );
}