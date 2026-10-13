'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, List as ListIcon } from 'lucide-react';
import { useCalendarData, type CalendarEntry } from '@/lib/hooks/use-views';
import { useSubtaskCounts } from '@/lib/hooks/use-tasks';
import { useTags } from '@/lib/hooks/use-org';
import { useUiStore } from '@/lib/ui-store';
import { cn } from '@/lib/utils';
import { Button, EmptyState, IconButton, Spinner } from '@/components/ui';
import { TaskRow } from './task-row';
import { DetailPanel } from './detail-panel';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_PER_CELL = 3;

type CalendarMode = 'month' | 'agenda';

export function CalendarWorkspace() {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const gridStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const gridEnd = addDays(gridStart, 41);

  const rangeStart = mode === 'month' ? gridStart : startOfDay(new Date());
  const rangeEnd = mode === 'month' ? gridEnd : addDays(startOfDay(new Date()), 30);

  const { days, isLoading, isError } = useCalendarData(rangeStart.toISOString(), rangeEnd.toISOString());
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d.items])), [days]);

  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  const selectedItems = dayMap.get(selectedDate) ?? [];

  return (
    <div className="flex h-full min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">
              {format(cursor, 'yyyy年 M月', { locale: zhCN })}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {mode === 'month' && (
              <>
                <IconButton aria-label="上一月" onClick={() => setCursor((c) => addMonths(c, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </IconButton>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const now = new Date();
                    setCursor(startOfMonth(now));
                    setSelectedDate(format(now, 'yyyy-MM-dd'));
                  }}
                >
                  今天
                </Button>
                <IconButton aria-label="下一月" onClick={() => setCursor((c) => addMonths(c, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </IconButton>
              </>
            )}
            <div className="ml-1 flex items-center gap-0.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <ModeButton active={mode === 'month'} onClick={() => setMode('month')}>
                <CalendarDays className="h-3.5 w-3.5" />
                月
              </ModeButton>
              <ModeButton active={mode === 'agenda'} onClick={() => setMode('agenda')}>
                <ListIcon className="h-3.5 w-3.5" />
                议程
              </ModeButton>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-5 w-5" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-400">
            日历加载失败，请稍后重试
          </div>
        ) : mode === 'month' ? (
          <div className="tf-scroll flex-1 overflow-auto p-4">
            <div className="min-w-[640px] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
                {WEEKDAYS.map((label) => (
                  <div key={label} className="px-2 py-2 text-center text-[12px] font-medium text-zinc-400">
                    周{label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  const key = format(cell, 'yyyy-MM-dd');
                  const items = dayMap.get(key) ?? [];
                  const inMonth = isSameMonth(cell, cursor);
                  const isSelected = key === selectedDate;
                  const today = isToday(cell);
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDate(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setSelectedDate(key);
                      }}
                      className={cn(
                        'flex min-h-[104px] cursor-pointer flex-col gap-1 border-b border-r border-zinc-100 p-1.5 text-left align-top transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-zinc-800/70',
                        !inMonth && 'bg-zinc-50/70 dark:bg-zinc-950/40',
                        isSelected ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums',
                          today
                            ? 'bg-brand-500 font-semibold text-white'
                            : inMonth
                              ? 'text-zinc-500 dark:text-zinc-400'
                              : 'text-zinc-300 dark:text-zinc-600',
                        )}
                      >
                        {format(cell, 'd')}
                      </span>
                      {items.slice(0, MAX_PER_CELL).map((entry) => (
                        <CellTask key={`${entry.task.id}-${entry.occurrenceDate}`} entry={entry} />
                      ))}
                      {items.length > MAX_PER_CELL && (
                        <span className="px-1 text-[11px] text-zinc-400">+{items.length - MAX_PER_CELL}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="tf-scroll flex-1 overflow-y-auto px-5 py-4">
            {days.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                title="接下来 30 天暂无安排"
                description="为任务设置截止时间后，会自动出现在议程里。"
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {days.map((day) => (
                  <div key={day.date}>
                    <div className="mb-1.5 flex items-baseline gap-2 px-1">
                      <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-300">
                        {format(new Date(`${day.date}T00:00:00`), 'M月d日', { locale: zhCN })}
                      </span>
                      <span className="text-[12px] text-zinc-400">
                        {format(new Date(`${day.date}T00:00:00`), 'EEEE', { locale: zhCN })}
                      </span>
                      <span className="text-[11px] tabular-nums text-zinc-300 dark:text-zinc-600">
                        {day.items.length}
                      </span>
                    </div>
                    <DayList items={day.items} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <DetailPanel
        empty={
          <DayPanel
            date={selectedDate}
            items={selectedItems}
            onToday={() => {
              const now = new Date();
              setCursor(startOfMonth(now));
              setSelectedDate(format(now, 'yyyy-MM-dd'));
            }}
          />
        }
      />
    </div>
  );
}

function DayPanel({ date, items, onToday }: { date: string; items: CalendarEntry[]; onToday: () => void }) {
  const isCurrentDay = isSameDay(new Date(`${date}T00:00:00`), new Date());
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">
            {format(new Date(`${date}T00:00:00`), 'M月d日 EEEE', { locale: zhCN })}
          </p>
          <p className="text-[12px] text-zinc-400">{items.length} 个任务</p>
        </div>
        {!isCurrentDay && (
          <Button size="sm" variant="ghost" onClick={onToday}>
            回到今天
          </Button>
        )}
      </header>
      <div className="tf-scroll flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-7 w-7" />}
            title="这一天没有任务"
            description="在左侧选择其他日期，或为任务设置截止时间。"
          />
        ) : (
          <DayList items={items} />
        )}
      </div>
    </div>
  );
}

function DayList({ items }: { items: CalendarEntry[] }) {
  const { data: tags = [] } = useTags();
  const subtaskCounts = useSubtaskCounts();
  return (
    <div className="space-y-0.5">
      {items.map((entry) => (
        <TaskRow
          key={`${entry.task.id}-${entry.occurrenceDate}`}
          task={entry.task}
          tags={tags}
          subtaskCounts={subtaskCounts}
        />
      ))}
    </div>
  );
}

function CellTask({ entry }: { entry: CalendarEntry }) {
  const selectTask = useUiStore((s) => s.selectTask);
  const completed = entry.task.status === 2;
  const priorityColor =
    entry.task.priority === 5 ? '#ef4444' : entry.task.priority === 3 ? '#f59e0b' : entry.task.priority === 1 ? '#3b82f6' : null;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        selectTask(entry.task.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          selectTask(entry.task.id);
        }
      }}
      className={cn(
        'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-brand-100/70 dark:hover:bg-brand-500/20',
        completed ? 'text-zinc-300 line-through dark:text-zinc-600' : 'text-zinc-600 dark:text-zinc-300',
      )}
    >
      {priorityColor && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
      )}
      <span className="truncate">{entry.task.title}</span>
    </span>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] transition-colors',
        active
          ? 'bg-white font-medium text-brand-600 shadow-sm dark:bg-zinc-700 dark:text-brand-300'
          : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}