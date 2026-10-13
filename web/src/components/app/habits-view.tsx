'use client';

import { useMemo, useState } from 'react';
import { addDays, format, startOfWeek, subWeeks } from 'date-fns';
import { Flame, MoreHorizontal, Pencil, Plus, Trash2, Trophy, Undo2 } from 'lucide-react';
import {
  useCheckHabit,
  useCreateHabit,
  useDeleteHabit,
  useHabitFromTemplate,
  useHabits,
  useHabitStats,
  useHabitTemplates,
  useUncheckHabit,
  useUpdateHabit,
  type HabitInput,
} from '@/lib/hooks/use-habits';
import { useSession } from '@/lib/session';
import { PRESET_COLORS, cn, colorToHex, hexToColorInt, localDateKey } from '@/lib/utils';
import { Button, Dropdown, EmptyState, Field, IconButton, Input, MenuItem, Modal, Spinner } from '@/components/ui';
import type { Habit, HabitStat } from '@/lib/types';

const EMOJI_PRESETS = [
  '💧', '📖', '🏃', '🧘', '🥗', '😴', '💪', '✍️', '🎯', '🎸',
  '🧹', '💰', '🌱', '☀️', '🚭', '🦷', '🛏️', '📝', '🧠', '🎨',
  '🍎', '🚶', '🧴', '🙏',
];

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function recordValue(habit: Habit, dateKey: string): number {
  const record = (habit.records ?? []).find((r) => r.date.slice(0, 10) === dateKey);
  return record?.value ?? 0;
}

export function HabitsWorkspace() {
  const timezone = useSession((s) => s.user?.timezone);
  const today = localDateKey(new Date(), timezone);

  const { data: habits = [], isLoading } = useHabits();
  const rangeFrom = format(startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: stats = [] } = useHabitStats(rangeFrom, today);
  const statMap = useMemo(() => new Map(stats.map((s) => [s.habitId, s])), [stats]);

  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [removing, setRemoving] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const deleteHabit = useDeleteHabit();
  const updateHabit = useUpdateHabit();

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <div className="tf-scroll h-full min-w-0 flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">习惯打卡</h1>
            <p className="mt-1 text-[13px] text-zinc-400">坚持每天一点，看看你的连续记录</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            新建习惯
          </Button>
        </header>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="h-5 w-5" />
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8" />}
            title="还没有习惯"
            description="从模板库挑一个开始，或创建你自己的习惯，每天打卡记录坚持。"
            action={
              <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" />
                新建习惯
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {active.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                stat={statMap.get(habit.id)}
                today={today}
                rangeFrom={rangeFrom}
                onEdit={() => setEditing(habit)}
                onArchive={() => updateHabit.mutate({ id: habit.id, archived: true })}
                onDelete={() => setRemoving(habit)}
              />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-[12px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {showArchived ? '收起' : '显示'}已归档（{archived.length}）
            </button>
            {showArchived && (
              <ul className="mt-3 space-y-1.5">
                {archived.map((habit) => (
                  <li
                    key={habit.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span className="text-lg">{habit.icon || '✅'}</span>
                    <span className="flex-1 truncate text-[13px] text-zinc-500 line-through">{habit.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => updateHabit.mutate({ id: habit.id, archived: false })}>
                      <Undo2 className="h-3.5 w-3.5" />
                      恢复
                    </Button>
                    <IconButton aria-label="删除" onClick={() => setRemoving(habit)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {editing && (
        <HabitEditorModal
          habit={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="删除习惯"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (removing) deleteHabit.mutate(removing.id);
                setRemoving(null);
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          确定删除「{removing?.name}」吗？该习惯的所有打卡记录也会一并隐藏。
        </p>
      </Modal>
    </div>
  );
}

/* -------------------------------- 习惯卡片 -------------------------------- */

function HabitCard({
  habit,
  stat,
  today,
  rangeFrom,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: Habit;
  stat?: HabitStat;
  today: string;
  rangeFrom: string;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const check = useCheckHabit();
  const uncheck = useUncheckHabit();
  const color = colorToHex(habit.color, '#3b6fe0');
  const counted = habit.goalType === 1;
  const target = Math.max(1, habit.targetValue);
  const value = recordValue(habit, today);
  const done = counted ? value >= target : value > 0;

  function toggle() {
    if (counted) {
      if (value >= target) uncheck.mutate({ id: habit.id, date: today });
      else check.mutate({ id: habit.id, date: today, value: value + 1 });
    } else if (done) {
      uncheck.mutate({ id: habit.id, date: today });
    } else {
      check.mutate({ id: habit.id, date: today, value: 1 });
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${color}1f` }}
        >
          {habit.icon || '✅'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{habit.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
              <Flame className="h-3 w-3" />
              {stat?.currentStreak ?? 0} 天
            </span>
            <span className="text-[11px] text-zinc-400">最长 {stat?.longestStreak ?? 0}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-zinc-400">
            {counted ? `目标 ${target} ${habit.unit || ''}` : '每日打卡'}
            {habit.frequency === 1 && habit.weekDays.length > 0
              ? ` · 每周 ${habit.weekDays.map((d) => WEEKDAY_LABELS[d]).join('、')}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className={cn(
              'h-9 rounded-xl px-3 text-[13px] font-medium transition-colors',
              done
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'text-white',
            )}
            style={done ? undefined : { backgroundColor: color }}
          >
            {counted ? (done ? `已完成 ${value}/${target}` : `+1（${value}/${target}）`) : done ? '已打卡' : '打卡'}
          </button>
          <Dropdown
            trigger={
              <IconButton aria-label="更多操作">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => {
                    onEdit();
                    close();
                  }}
                >
                  编辑
                </MenuItem>
                <MenuItem
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    onArchive();
                    close();
                  }}
                >
                  归档
                </MenuItem>
                <MenuItem
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  danger
                  onClick={() => {
                    onDelete();
                    close();
                  }}
                >
                  删除
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <Heatmap days={stat?.days ?? []} from={rangeFrom} target={target} color={color} />
    </section>
  );
}

/* --------------------------------- 热力图 --------------------------------- */

function Heatmap({
  days,
  from,
  target,
  color,
}: {
  days: { date: string; value: number }[];
  from: string;
  target: number;
  color: string;
}) {
  const valueMap = useMemo(() => new Map(days.map((d) => [d.date, d.value])), [days]);
  const weeks = useMemo(() => {
    const start = new Date(`${from}T00:00:00`);
    const todayStart = new Date(`${format(new Date(), 'yyyy-MM-dd')}T00:00:00`);
    const result: { date: string; level: number; future: boolean }[][] = [];
    let cursor = start;
    while (cursor <= todayStart) {
      const column: { date: string; level: number; future: boolean }[] = [];
      for (let i = 0; i < 7; i += 1) {
        const key = format(cursor, 'yyyy-MM-dd');
        const value = valueMap.get(key) ?? 0;
        const ratio = target > 0 ? value / target : 0;
        const level = value <= 0 ? 0 : ratio >= 1 ? 4 : ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1;
        column.push({ date: key, level, future: cursor > todayStart });
        cursor = addDays(cursor, 1);
      }
      result.push(column);
    }
    return result;
  }, [from, target, valueMap]);

  const opacity = [0, 0.25, 0.45, 0.7, 1];

  return (
    <div className="mt-4">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}${cell.level > 0 ? ` · 已完成` : ''}`}
                className={cn('h-[11px] w-[11px] rounded-[3px]', cell.level === 0 && 'bg-zinc-100 dark:bg-zinc-800')}
                style={cell.level > 0 ? { backgroundColor: color, opacity: opacity[cell.level] } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-zinc-400">
        少
        {opacity.map((o, i) => (
          <span
            key={i}
            className={cn('h-[10px] w-[10px] rounded-[3px]', i === 0 && 'bg-zinc-100 dark:bg-zinc-800')}
            style={i > 0 ? { backgroundColor: color, opacity: o } : undefined}
          />
        ))}
        多
      </div>
    </div>
  );
}

/* ------------------------------- 新建 / 编辑 ------------------------------- */

function HabitEditorModal({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const isEdit = !!habit;
  const [tab, setTab] = useState<'template' | 'custom'>(isEdit ? 'custom' : 'template');

  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '✅');
  const [color, setColor] = useState(colorToHex(habit?.color, PRESET_COLORS[0]));
  const [counted, setCounted] = useState(habit?.goalType === 1);
  const [targetValue, setTargetValue] = useState(habit?.targetValue ?? 1);
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [weekly, setWeekly] = useState(habit?.frequency === 1);
  const [weekDays, setWeekDays] = useState<number[]>(habit?.weekDays ?? [1, 2, 3, 4, 5]);

  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const fromTemplate = useHabitFromTemplate();
  const { data: templates = [], isLoading: templatesLoading } = useHabitTemplates();

  const pending = createHabit.isPending || updateHabit.isPending || fromTemplate.isPending;

  function payload(): HabitInput {
    return {
      name: name.trim(),
      icon,
      color: hexToColorInt(color),
      goalType: counted ? 1 : 0,
      targetValue: counted ? Math.max(1, targetValue) : 1,
      unit: counted ? unit.trim() || null : null,
      frequency: weekly ? 1 : 0,
      weekDays: weekly ? weekDays : [],
    };
  }

  async function submit() {
    if (!name.trim()) return;
    if (isEdit && habit) await updateHabit.mutateAsync({ id: habit.id, ...payload() });
    else await createHabit.mutateAsync(payload());
    onClose();
  }

  async function useTemplate(templateId: string) {
    await fromTemplate.mutateAsync(templateId);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '编辑习惯' : '新建习惯'}
      footer={
        tab === 'custom' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button variant="primary" loading={pending} disabled={!name.trim()} onClick={submit}>
              {isEdit ? '保存' : '创建'}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
        )
      }
    >
      {!isEdit && (
        <div className="mb-4 flex items-center gap-0.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {(['template', 'custom'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-[13px] transition-colors',
                tab === value
                  ? 'bg-white font-medium text-brand-600 shadow-sm dark:bg-zinc-700 dark:text-brand-300'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
              )}
            >
              {value === 'template' ? '模板库' : '自定义'}
            </button>
          ))}
        </div>
      )}

      {tab === 'template' && !isEdit ? (
        templatesLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => useTemplate(template.id)}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-zinc-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
              >
                <span className="text-lg">{template.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 dark:text-zinc-200">
                  {template.title}
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <Field label="名称">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="如：每天阅读 30 分钟" />
          </Field>

          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">图标</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors',
                    icon === emoji
                      ? 'bg-brand-50 ring-2 ring-brand-400 dark:bg-brand-500/15'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">颜色</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={preset}
                  onClick={() => setColor(preset)}
                  className={cn(
                    'h-7 w-7 rounded-full ring-offset-2 transition-transform hover:scale-110 dark:ring-offset-zinc-900',
                    color === preset ? 'ring-2 ring-zinc-400' : '',
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">目标类型</span>
            <div className="flex gap-1.5">
              {[
                { value: false, label: '纯打卡' },
                { value: true, label: '计数目标' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setCounted(option.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-[13px] transition-colors',
                    counted === option.value
                      ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {counted && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="目标值">
                <Input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <Field label="单位">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="如：杯 / 页" />
              </Field>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">频率</span>
            <div className="flex gap-1.5">
              {[
                { value: false, label: '每天' },
                { value: true, label: '每周指定' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setWeekly(option.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-[13px] transition-colors',
                    weekly === option.value
                      ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {weekly && (
              <div className="flex gap-1.5 pt-1">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setWeekDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
                    }
                    className={cn(
                      'h-8 w-9 rounded-lg text-[12px] transition-colors',
                      weekDays.includes(day)
                        ? 'bg-brand-500 text-white'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                    )}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}