import { z } from 'zod';

export const settingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  weekStart: z.coerce.number().int().min(0).max(6).optional(),
  dayStartHour: z.coerce.number().int().min(0).max(23).optional(),
  dateFormat: z.string().max(32).optional(),
  modulePomodoro: z.boolean().optional(),
  moduleHabits: z.boolean().optional(),
  moduleMatrix: z.boolean().optional(),
  moduleCalendar: z.boolean().optional(),
  smartListsVisible: z.array(z.string().max(32)).optional(),
  defaultListId: z.string().uuid().nullable().optional(),
  defaultPriority: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]).optional(),
  defaultReminderOffset: z.coerce.number().int().nullable().optional(),
  focusSettings: z.record(z.any()).nullable().optional(),
});
export type SettingsUpdateDto = z.infer<typeof settingsUpdateSchema>;