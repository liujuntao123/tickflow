export interface FocusSettings {
  /** 专注时长（分钟） */
  focusMinutes: number;
  /** 短休息（分钟） */
  shortBreakMinutes: number;
  /** 长休息（分钟） */
  longBreakMinutes: number;
  /** 每 N 个番茄后进入长休息 */
  longBreakEvery: number;
  /** 结束后自动开始下一段 */
  autoStartNext: boolean;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartNext: true,
};

export const FOCUS_PRESETS = [25, 45, 60];

const MINUTE = 60;

function pickNumber(raw: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = Number(raw[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 服务端 focusSettings 为自由 JSON，这里做一次宽容解析。 */
export function parseFocusSettings(raw: unknown): FocusSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FOCUS_SETTINGS };
  const obj = raw as Record<string, unknown>;
  return {
    focusMinutes: pickNumber(obj, 'focusMinutes', DEFAULT_FOCUS_SETTINGS.focusMinutes, 1, 180),
    shortBreakMinutes: pickNumber(obj, 'shortBreakMinutes', DEFAULT_FOCUS_SETTINGS.shortBreakMinutes, 1, 60),
    longBreakMinutes: pickNumber(obj, 'longBreakMinutes', DEFAULT_FOCUS_SETTINGS.longBreakMinutes, 1, 120),
    longBreakEvery: pickNumber(obj, 'longBreakEvery', DEFAULT_FOCUS_SETTINGS.longBreakEvery, 1, 12),
    autoStartNext: typeof obj.autoStartNext === 'boolean' ? obj.autoStartNext : DEFAULT_FOCUS_SETTINGS.autoStartNext,
  };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / MINUTE);
  const seconds = safe % MINUTE;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}