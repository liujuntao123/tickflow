/** 优先级取值对齐原版：0=无 1=低 3=中 5=高 */
export const PRIORITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 3,
  HIGH: 5,
} as const;

export type PriorityValue = (typeof PRIORITY)[keyof typeof PRIORITY];

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

export function isValidPriority(value: number): value is PriorityValue {
  return value === 0 || value === 1 || value === 3 || value === 5;
}

/** 任务状态：0=未完成 2=已完成（对齐原版取值） */
export const TASK_STATUS = {
  OPEN: 0,
  COMPLETED: 2,
} as const;