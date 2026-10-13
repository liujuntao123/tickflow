import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isThisYear, isToday, isTomorrow, isYesterday, startOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 后端用整数存颜色（如 3355443 = #333333）。 */
export function colorToHex(color: number | null | undefined, fallback = '#94a3b8'): string {
  if (color === null || color === undefined) return fallback;
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 颜色选择面板使用的低饱和预设。 */
export const PRESET_COLORS = [
  '#3B6FE0',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#64748b',
];

export function hexToColorInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export function initialOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

/** 有效到期时间：重复任务优先 nextDueDate。 */
export function effectiveDue(task: { dueDate: string | null; nextDueDate?: string | null }): Date | null {
  const raw = task.nextDueDate ?? task.dueDate;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal';

export function dueTone(due: Date | null): DueTone {
  if (!due) return 'normal';
  const today = startOfDay(new Date());
  const day = startOfDay(due);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 2) return 'soon';
  return 'normal';
}

export function formatDue(due: Date | null, allDay = false): string {
  if (!due) return '';
  if (isToday(due)) return allDay ? '今天' : `今天 ${format(due, 'HH:mm')}`;
  if (isTomorrow(due)) return allDay ? '明天' : `明天 ${format(due, 'HH:mm')}`;
  if (isYesterday(due)) return allDay ? '昨天' : `昨天 ${format(due, 'HH:mm')}`;
  const sameYear = isThisYear(due);
  const datePart = format(due, sameYear ? 'M月d日' : 'yyyy年M月d日', { locale: zhCN });
  return allDay ? datePart : `${datePart} ${format(due, 'HH:mm')}`;
}

export function formatDayLabel(d: Date): string {
  if (isToday(d)) return '今天';
  if (isTomorrow(d)) return '明天';
  if (isYesterday(d)) return '昨天';
  return format(d, isThisYear(d) ? 'M月d日' : 'yyyy年M月d日', { locale: zhCN });
}

/** 按用户时区取本地日期键（YYYY-MM-DD），与服务端 todayKey 对齐。 */
export function localDateKey(date: Date, timezone?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return format(date, 'yyyy-MM-dd');
  }
}

/** datetime-local 输入框需要本地时间的 YYYY-MM-DDTHH:mm。 */
export function toDatetimeLocal(d: Date | null): string {
  if (!d) return '';
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 本地某天 23:59:59 的 UTC ISO，用于“今天/明天”快捷按钮。 */
export function endOfDayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export function nextWeekIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}