/**
 * 共享常量的本地镜像。真源为 packages/contracts/src/*，
 * web 侧不引入其构建产物以保持构建自包含（详见 README）。
 */

export const PRIORITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 3,
  HIGH: 5,
} as const;

export const PRIORITY_LABELS: Record<number, string> = {
  0: '无',
  1: '低',
  3: '中',
  5: '高',
};

export const PRIORITY_COLORS: Record<number, string> = {
  0: '#9ca3af',
  1: '#3b82f6',
  3: '#f59e0b',
  5: '#ef4444',
};

export const PRIORITY_OPTIONS = [0, 1, 3, 5] as const;

export const TASK_STATUS = {
  OPEN: 0,
  COMPLETED: 2,
} as const;

export const SMART_LIST_KEYS = ['inbox', 'today', 'tomorrow', 'next7', 'all', 'completed'] as const;

export type SmartListKey = (typeof SMART_LIST_KEYS)[number];

export const SMART_LIST_LABELS: Record<SmartListKey, string> = {
  inbox: '收件箱',
  today: '今天',
  tomorrow: '明天',
  next7: '未来 7 天',
  all: '所有',
  completed: '已完成',
};

export const QUADRANT_LABELS: Record<string, string> = {
  q1: '重要且紧急',
  q2: '重要不紧急',
  q3: '紧急不重要',
  q4: '不重要不紧急',
};