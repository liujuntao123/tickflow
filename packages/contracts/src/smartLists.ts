/**
 * 智能清单与四象限规则常量（三端共用，便于微调语义）。
 * 谓词实现在服务端 SQL；端上仅用于展示与排序。
 */

export const SMART_LIST_KEYS = [
  'inbox',
  'today',
  'tomorrow',
  'next7',
  'all',
  'completed',
] as const;

export type SmartListKey = (typeof SMART_LIST_KEYS)[number];

export const SMART_LIST_LABELS: Record<SmartListKey, string> = {
  inbox: '收件箱',
  today: '今天',
  tomorrow: '明天',
  next7: '未来 7 天',
  all: '所有',
  completed: '已完成',
};

/**
 * today: 有效到期 ≤ 用户本地“今天”结束（含已过期）；
 * next7: 有效到期 ∈ [今天开始, 今天+7 天结束)；
 * 重复任务的有效到期 = COALESCE(next_due_date, due_date)。
 */
export const SMART_LIST_SEMANTICS = {
  todayIncludesOverdue: true,
  next7IncludesToday: true,
  repeatEffectiveDue: 'COALESCE(next_due_date, due_date)',
} as const;

/** 四象限：重要 = priority ∈ {3,5}；紧急 = 有效到期 ≤ 明天结束 */
export const QUADRANTS = {
  importantPriorities: [3, 5] as const,
  urgencyHorizonDays: 1,
} as const;

export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';

export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  q1: '重要且紧急',
  q2: '重要不紧急',
  q3: '紧急不重要',
  q4: '不重要不紧急',
};