import { z } from 'zod';

const zDate = z.coerce.date();

export const habitCreateSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(64).nullable().optional(),
  color: z.number().int().nullable().optional(),
  goalType: z.coerce.number().int().min(0).max(1).optional(),
  targetValue: z.coerce.number().int().min(1).optional(),
  unit: z.string().max(32).nullable().optional(),
  frequency: z.coerce.number().int().min(0).max(3).optional(),
  weekDays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  repeatRule: z.string().max(500).nullable().optional(),
  startDate: zDate.optional(),
  reminders: z.array(z.record(z.any())).nullable().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export type HabitCreateDto = z.infer<typeof habitCreateSchema>;

export const habitUpdateSchema = habitCreateSchema.partial();
export type HabitUpdateDto = z.infer<typeof habitUpdateSchema>;

export const checkSchema = z.object({ date: zDate, value: z.coerce.number().int().min(0).optional() });
export const uncheckSchema = z.object({ date: zDate });

export const statsQuerySchema = z.object({
  from: zDate.optional(),
  to: zDate.optional(),
});

export const fromTemplateSchema = z.object({ templateId: z.string().min(1) });