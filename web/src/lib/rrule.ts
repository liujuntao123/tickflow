/**
 * 重复任务规则（RRULE 子集）构建 / 解析 / 中文描述 / 客户端展开。
 *
 * 白名单格式：
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY;INTERVAL=n[;BYDAY=MO,TU][;BYMONTHDAY=d][;COUNT=n|;UNTIL=YYYYMMDDTHHMMSSZ]
 *
 * 注意：本文件刻意不引入任何相对路径依赖，便于用 Node（默认类型剥离）直接单测。
 */
import {
  addDays,
  addMonths,
  addYears,
  getDay,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type RepeatFreq = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RepeatEndMode = 'never' | 'until' | 'count';

export interface RepeatConfig {
  freq: RepeatFreq;
  interval: number;
  /** WEEKLY 使用，取值 MO..SU */
  byDay: string[];
  /** MONTHLY 使用，1..31 */
  byMonthDay: number | null;
  end: RepeatEndMode;
  /** YYYY-MM-DD（本地日期） */
  until: string | null;
  count: number | null;
  /** 0 = 按截止日，1 = 按完成日 */
  repeatFrom: 0 | 1;
}

export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export const WEEKDAY_LABELS: Record<string, string> = {
  MO: '周一',
  TU: '周二',
  WE: '周三',
  TH: '周四',
  FR: '周五',
  SA: '周六',
  SU: '周日',
};
export const FREQ_LABELS: Record<RepeatFreq, string> = {
  NONE: '不重复',
  DAILY: '每天',
  WEEKLY: '每周',
  MONTHLY: '每月',
  YEARLY: '每年',
};

export const EMPTY_REPEAT: RepeatConfig = {
  freq: 'NONE',
  interval: 1,
  byDay: [],
  byMonthDay: null,
  end: 'never',
  until: null,
  count: null,
  repeatFrom: 0,
};

const CODE_INDEX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

/** JS getDay()（0=周日）→ RRULE 星期码 */
export function jsDayToCode(jsDay: number): string {
  return WEEKDAY_CODES[(jsDay + 6) % 7];
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/** 'YYYY-MM-DD' → 'YYYYMMDDT235959Z' */
export function untilToRRule(until: string): string {
  const [y, m, d] = until.split('-').map((v) => Number(v));
  return `${pad(y, 4)}${pad(m)}${pad(d)}T235959Z`;
}

/** 'YYYYMMDDTHHMMSSZ' → 'YYYY-MM-DD' */
export function rruleToUntil(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function buildRRule(cfg: RepeatConfig): string | null {
  if (cfg.freq === 'NONE') return null;
  const parts = [`FREQ=${cfg.freq}`, `INTERVAL=${Math.max(1, cfg.interval || 1)}`];
  if (cfg.freq === 'WEEKLY' && cfg.byDay.length > 0) {
    const ordered = [...cfg.byDay].sort((a, b) => (CODE_INDEX[a] ?? 9) - (CODE_INDEX[b] ?? 9));
    parts.push(`BYDAY=${ordered.join(',')}`);
  }
  if (cfg.freq === 'MONTHLY' && cfg.byMonthDay) parts.push(`BYMONTHDAY=${cfg.byMonthDay}`);
  if (cfg.end === 'count' && cfg.count) parts.push(`COUNT=${cfg.count}`);
  else if (cfg.end === 'until' && cfg.until) parts.push(`UNTIL=${untilToRRule(cfg.until)}`);
  return parts.join(';');
}

export function parseRRule(rule: string | null | undefined): RepeatConfig {
  if (!rule) return { ...EMPTY_REPEAT };
  const cfg: RepeatConfig = { ...EMPTY_REPEAT, freq: 'NONE' };
  for (const segment of rule.split(';')) {
    const [rawKey, rawValue] = segment.split('=');
    const key = (rawKey ?? '').toUpperCase();
    const value = rawValue ?? '';
    if (key === 'FREQ') {
      const freq = value.toUpperCase() as RepeatFreq;
      if (freq === 'DAILY' || freq === 'WEEKLY' || freq === 'MONTHLY' || freq === 'YEARLY') cfg.freq = freq;
    } else if (key === 'INTERVAL') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1) cfg.interval = Math.floor(n);
    } else if (key === 'BYDAY') {
      cfg.byDay = value
        .split(',')
        .map((v) => v.trim().toUpperCase())
        .filter((v) => v in CODE_INDEX);
    } else if (key === 'BYMONTHDAY') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1 && n <= 31) cfg.byMonthDay = Math.floor(n);
    } else if (key === 'COUNT') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) {
        cfg.end = 'count';
        cfg.count = Math.floor(n);
      }
    } else if (key === 'UNTIL') {
      const v = value.trim().toUpperCase().replace(/Z$/, '');
      if (v.length >= 8) {
        cfg.end = 'until';
        cfg.until = rruleToUntil(v);
      }
    }
  }
  return cfg;
}

export function describeRepeat(rule: string | null | undefined): string {
  const cfg = parseRRule(rule);
  if (cfg.freq === 'NONE') return '不重复';
  const n = cfg.interval;
  let text: string;
  if (cfg.freq === 'DAILY') text = n === 1 ? '每天' : `每 ${n} 天`;
  else if (cfg.freq === 'YEARLY') text = n === 1 ? '每年' : `每 ${n} 年`;
  else if (cfg.freq === 'MONTHLY') {
    const base = n === 1 ? '每月' : `每 ${n} 个月`;
    text = cfg.byMonthDay ? `${base} ${cfg.byMonthDay} 日` : base;
  } else {
    const dayLabels = cfg.byDay.map((d) => WEEKDAY_LABELS[d] ?? d).join('、');
    text = cfg.byDay.length ? (n === 1 ? `每${dayLabels}` : `每 ${n} 周 · ${dayLabels}`) : n === 1 ? '每周' : `每 ${n} 周`;
  }
  if (cfg.end === 'count' && cfg.count) text += `，共 ${cfg.count} 次`;
  else if (cfg.end === 'until' && cfg.until) text += `，至 ${cfg.until}`;
  return text;
}

function* series(cfg: RepeatConfig, start: Date): Generator<Date> {
  const interval = Math.max(1, cfg.interval || 1);
  if (cfg.freq === 'DAILY') {
    for (let i = 0; ; i += 1) yield addDays(start, i * interval);
    return;
  }
  if (cfg.freq === 'WEEKLY') {
    const codes = cfg.byDay.length > 0 ? cfg.byDay : [jsDayToCode(getDay(start))];
    const idxs = codes
      .map((c) => CODE_INDEX[c])
      .filter((i) => i !== undefined)
      .sort((a, b) => a - b);
    const weekStart = startOfWeek(start, { weekStartsOn: 1 });
    for (let w = 0; ; w += 1) {
      const base = addDays(weekStart, w * 7 * interval);
      for (const i of idxs) {
        const candidate = addDays(base, i);
        if (candidate.getTime() < start.getTime()) continue;
        yield candidate;
      }
    }
    return;
  }
  if (cfg.freq === 'MONTHLY') {
    const monthStart = startOfMonth(start);
    for (let m = 0; ; m += 1) {
      const base = addMonths(monthStart, m * interval);
      const day = Math.min(cfg.byMonthDay ?? start.getDate(), getDaysInMonth(base));
      const candidate = new Date(base.getFullYear(), base.getMonth(), day, start.getHours(), start.getMinutes(), start.getSeconds());
      if (candidate.getTime() < start.getTime()) continue;
      yield candidate;
    }
    return;
  }
  for (let y = 0; ; y += 1) yield addYears(start, y * interval);
}

/** 生成 [from, to] 区间内的所有发生日（含 dtstart 之前的发生不返回）。 */
export function expandOccurrences(
  rule: string | null | undefined,
  dtstart: Date,
  from: Date,
  to: Date,
  max = 1000,
): Date[] {
  const cfg = parseRRule(rule);
  if (cfg.freq === 'NONE') return [];
  const start = startOfDay(dtstart);
  const fromTime = startOfDay(from).getTime();
  const toTime = startOfDay(to).getTime();
  if (start.getTime() > toTime) return [];

  const untilTime =
    cfg.end === 'until' && cfg.until ? new Date(`${cfg.until}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  const limitTime = Math.min(toTime, untilTime);

  const results: Date[] = [];
  let produced = 0;
  let guard = 0;
  for (const date of series(cfg, start)) {
    guard += 1;
    if (guard > 20000) break;
    if (date.getTime() > limitTime) break;
    produced += 1;
    if (cfg.end === 'count' && cfg.count && produced > cfg.count) break;
    if (date.getTime() >= fromTime) results.push(date);
    if (results.length >= max) break;
  }
  return results;
}