import { z } from 'zod';

const zDate = z.coerce.date();
const priorityEnum = z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]);
const statusEnum = z.union([z.literal(0), z.literal(2)]);

export const checklistItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    checked: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
  .passthrough();

export const reminderSchema = z.object({ offset: z.coerce.number().int() }).passthrough();

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(1000),
  listId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  completedAt: zDate.nullable().optional(),
  dueDate: zDate.nullable().optional(),
  isAllDay: z.boolean().optional(),
  startDate: zDate.nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  recurrenceTz: z.string().max(64).nullable().optional(),
  recurrenceDtstart: zDate.nullable().optional(),
  recurrenceEnd: zDate.nullable().optional(),
  repeatFrom: z.coerce.number().int().min(0).max(1).optional(),
  nextDueDate: zDate.nullable().optional(),
  reminders: z.array(reminderSchema).nullable().optional(),
  reminderRepeatMinutes: z.coerce.number().int().nullable().optional(),
  checklist: z.array(checklistItemSchema).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  subtasks: z.array(z.object({ title: z.string().min(1), priority: priorityEnum.optional() })).max(200).optional(),
});
export type TaskCreateDto = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema
  .omit({ subtasks: true })
  .partial();
export type TaskUpdateDto = z.infer<typeof taskUpdateSchema>;

export const taskQuerySchema = z.object({
  listId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  topLevel: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  status: z.coerce.number().int().optional(),
  priority: z.coerce.number().int().optional(),
  from: zDate.optional(),
  to: zDate.optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;

export const moveSchema = z.object({ listId: z.string().uuid(), sortOrder: z.coerce.number().int().optional() });

export const taskReorderSchema = z.object({
  listId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  orderedIds: z.array(z.string().uuid()).max(5000),
});

export const checklistReplaceSchema = z.object({ checklist: z.array(checklistItemSchema) });

export const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(2000),
  action: z.enum(['complete', 'delete', 'move', 'priority', 'addTag']),
  payload: z
    .object({
      listId: z.string().uuid().optional(),
      priority: priorityEnum.optional(),
      tagId: z.string().uuid().optional(),
    })
    .optional(),
});

export const idQuerySchema = z.object({
  hard: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});