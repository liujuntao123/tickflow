export interface User {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  createdAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  color: number | null;
  sortOrder: string;
  _count?: { lists?: number };
}

export interface TaskList {
  id: string;
  name: string;
  folderId: string | null;
  color: number | null;
  icon: string | null;
  isInbox: boolean;
  isArchived: boolean;
  sortOrder: string;
  _count?: { tasks?: number };
}

export interface Tag {
  id: string;
  name: string;
  color: number | null;
  sortOrder: string;
  _count?: { tasks?: number };
}

export interface ChecklistItem {
  id: string;
  title: string;
  checked: boolean;
  sortOrder: number;
}

export interface Task {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  notes: string | null;
  priority: number;
  status: number;
  completedAt: string | null;
  dueDate: string | null;
  isAllDay: boolean;
  startDate: string | null;
  timezone: string | null;
  recurrenceRule: string | null;
  recurrenceTz: string | null;
  recurrenceDtstart: string | null;
  recurrenceEnd: string | null;
  repeatFrom: number;
  nextDueDate: string | null;
  reminders: { offset: number }[] | null;
  reminderRepeatMinutes: number | null;
  checklist: ChecklistItem[] | null;
  sortOrder: string;
  tagIds: string[];
  updatedAt: string;
  subtasks?: Task[];
}

export interface ViewGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export interface ViewResponse {
  key: string;
  groupBy: string;
  groups: ViewGroup[];
}

export interface ViewCounts {
  inbox: number;
  today: number;
  tomorrow: number;
  next7: number;
}

export interface SearchResult {
  type: 'task' | 'list' | 'tag' | string;
  id: string;
  title: string;
  subtitle: string | null;
}

export interface UserSettings {
  userId?: string;
  theme: string;
  weekStart: number;
  dayStartHour: number;
  dateFormat: string | null;
  modulePomodoro: boolean;
  moduleHabits: boolean;
  moduleMatrix: boolean;
  moduleCalendar: boolean;
  smartListsVisible: string[] | null;
  defaultListId: string | null;
  defaultPriority: number | null;
  defaultReminderOffset: number | null;
  focusSettings: unknown;
}

/* --------------------------------- habits -------------------------------- */

export interface HabitRecord {
  id: string;
  habitId: string;
  date: string;
  value: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string | null;
  color: number | null;
  /** 0 = 纯打卡，1 = 计数目标 */
  goalType: number;
  targetValue: number;
  unit: string | null;
  /** 0 = 每天，1 = 每周指定星期 */
  frequency: number;
  weekDays: number[];
  startDate: string;
  archived: boolean;
  sortOrder: string;
  records?: HabitRecord[];
}

export interface HabitTemplate {
  id: string;
  title: string;
  icon: string;
  color: number;
  category: string;
  defaultGoalType: number;
  defaultTargetValue: number;
  defaultUnit: string | null;
  frequency: number;
  sortOrder: number;
}

export interface HabitStat {
  habitId: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  days: { date: string; value: number }[];
}

/* --------------------------------- focus --------------------------------- */

export interface FocusSession {
  id: string;
  taskId: string | null;
  mode: number;
  plannedSeconds: number;
  startedAt: string;
  endedAt: string | null;
  actualSeconds: number;
  breakSeconds: number;
  pauseCount: number;
  /** 0 进行中 / 1 暂停 / 2 完成 / 3 取消 */
  status: number;
  interrupted: boolean;
  note: string | null;
}

export interface FocusStats {
  totalSeconds: number;
  sessionCount: number;
  byDay: { date: string; totalSeconds: number; count: number }[];
}

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type GroupBy = 'list' | 'date' | 'priority' | 'quadrant';