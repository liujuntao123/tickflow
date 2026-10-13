import { rrulestr, RRule } from 'rrule';
import { AppException } from './errors';

/**
 * RRULE 简化子集（白名单）：
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY
 *   INTERVAL=n
 *   BYDAY=MO,TU,...        （仅 WEEKLY）
 *   BYMONTHDAY=n           （仅 MONTHLY）
 *   COUNT=n  或  UNTIL=YYYYMMDDTHHMMSSZ   （二选一）
 *
 * 说明：时区处理按「UTC 构造 + 本地日期分组」简化实现——以 recurrenceDtstart 的
 * 绝对时刻作为 dtstart 展开，重复间隔按 UTC 计算，再按用户时区归入本地日期。
 * 对有夏令时的时区会有小时级偏移，v1 不处理。
 */

const ALLOWED_KEYS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'COUNT', 'UNTIL']);
const FREQS = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const WEEKDAYS = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
/** 单次展开的硬上限，避免规则异常导致爆炸。 */
const EXPAND_LIMIT = 2000;

function invalid(detail: string): AppException {
  return AppException.badRequest('重复规则不合法', { detail }, 'invalid_recurrence');
}

/** 校验白名单语法，并用 rrule parse 一次确认合法；不合法抛 400 invalid_recurrence。 */
export function validateRecurrence(rule: unknown): asserts rule is string {
  if (typeof rule !== 'string' || rule.trim() === '') throw invalid('empty rule');
  const upper = rule.toUpperCase();
  const seen = new Set<string>();
  let freq: string | undefined;
  let count: string | undefined;
  let until: string | undefined;

  for (const part of upper.split(';').map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq <= 0 || eq === part.length - 1) throw invalid(`bad part: ${part}`);
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!ALLOWED_KEYS.has(key)) throw invalid(`unknown key: ${key}`);
    if (seen.has(key)) throw invalid(`duplicate key: ${key}`);
    seen.add(key);

    if (key === 'FREQ') {
      if (!FREQS.has(value)) throw invalid(`bad FREQ: ${value}`);
      freq = value;
    } else if (key === 'INTERVAL') {
      if (!/^\d+$/.test(value) || Number(value) < 1) throw invalid(`bad INTERVAL: ${value}`);
    } else if (key === 'BYDAY') {
      const days = value.split(',');
      if (days.length === 0 || days.some((d) => !WEEKDAYS.has(d))) throw invalid(`bad BYDAY: ${value}`);
    } else if (key === 'BYMONTHDAY') {
      const n = Number(value);
      if (!/^-?\d+$/.test(value) || Math.abs(n) < 1 || Math.abs(n) > 31) throw invalid(`bad BYMONTHDAY: ${value}`);
    } else if (key === 'COUNT') {
      if (!/^\d+$/.test(value) || Number(value) < 1) throw invalid(`bad COUNT: ${value}`);
      count = value;
    } else if (key === 'UNTIL') {
      if (!/^\d{8}T\d{6}Z$/.test(value)) throw invalid(`bad UNTIL: ${value}`);
      until = value;
    }
  }

  if (!freq) throw invalid('FREQ is required');
  if (count && until) throw invalid('COUNT and UNTIL are mutually exclusive');
  if (seen.has('BYDAY') && freq !== 'WEEKLY') throw invalid('BYDAY is only allowed with FREQ=WEEKLY');
  if (seen.has('BYMONTHDAY') && freq !== 'MONTHLY') throw invalid('BYMONTHDAY is only allowed with FREQ=MONTHLY');

  try {
    rrulestr(upper, { dtstart: new Date(0) });
  } catch {
    throw invalid('rrule parse failed');
  }
}

function buildRule(rule: string, dtstart: Date): RRule {
  return rrulestr(rule.toUpperCase(), { dtstart });
}

/** 展开 [from, to) 窗口内的 occurrence（绝对时刻）。 */
export function expandOccurrences(rule: string, dtstart: Date, from: Date, to: Date): Date[] {
  if (to.getTime() <= from.getTime()) return [];
  const ruleObj = buildRule(rule, dtstart);
  const end = new Date(to.getTime() - 1);
  return ruleObj.between(from, end, true).slice(0, EXPAND_LIMIT);
}

/** 严格晚于 base 的第一个 occurrence；无（规则结束）返回 null。 */
export function nextOccurrenceAfter(rule: string, dtstart: Date, base: Date): Date | null {
  return buildRule(rule, dtstart).after(base, false) ?? null;
}

/** base 所在（或之前最近）的那一次 occurrence；无返回 null。 */
export function occurrenceAtOrBefore(rule: string, dtstart: Date, base: Date): Date | null {
  return buildRule(rule, dtstart).before(base, true) ?? null;
}