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
  smartListsVisible: boolean;
  defaultListId: string | null;
  defaultPriority: number | null;
  defaultReminderOffset: number | null;
  focusSettings: unknown;
}

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type GroupBy = 'list' | 'date' | 'priority' | 'quadrant';