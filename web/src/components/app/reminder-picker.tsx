'use client';

import { AlarmClock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dropdown } from '@/components/ui';

export const REMINDER_OPTIONS = [
  { offset: 0, label: '准时' },
  { offset: 5, label: '提前 5 分钟' },
  { offset: 30, label: '提前 30 分钟' },
  { offset: 60, label: '提前 1 小时' },
  { offset: 1440, label: '提前 1 天' },
];

const LABEL_BY_OFFSET = new Map(REMINDER_OPTIONS.map((o) => [o.offset, o.label]));

export function ReminderPicker({ value, onChange }: { value: number[]; onChange: (offsets: number[]) => void }) {
  const sorted = [...new Set(value)].sort((a, b) => a - b);
  const summary =
    sorted.length === 0
      ? '无提醒'
      : sorted.length === 1
        ? (LABEL_BY_OFFSET.get(sorted[0]) ?? `提前 ${sorted[0]} 分钟`)
        : `${sorted.length} 个提醒`;

  return (
    <Dropdown
      align="start"
      panelClassName="w-[13rem]"
      trigger={
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors',
            sorted.length === 0
              ? 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800'
              : 'border-brand-200 bg-brand-50/60 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300',
          )}
        >
          <AlarmClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{summary}</span>
        </button>
      }
    >
      {REMINDER_OPTIONS.map((opt) => {
        const active = sorted.includes(opt.offset);
        return (
          <button
            key={opt.offset}
            type="button"
            onClick={() => onChange(active ? sorted.filter((o) => o !== opt.offset) : [...sorted, opt.offset])}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="flex-1">{opt.label}</span>
            {active && <Check className="h-3.5 w-3.5 text-brand-500" />}
          </button>
        );
      })}
    </Dropdown>
  );
}