import { z } from 'zod';

const zDate = z.coerce.date();

export const focusCreateSchema = z.object({
  taskId: z.string().uuid().nullable().optional(),
  mode: z.coerce.number().int().min(0).max(2).optional(),
  plannedSeconds: z.coerce.number().int().min(1).max(24 * 60 * 60),
  note: z.string().max(1000).nullable().optional(),
});

export const focusPatchSchema = z.object({
  action: z.enum(['pause', 'resume', 'complete', 'cancel']),
  actualSeconds: z.coerce.number().int().min(0).optional(),
  breakSeconds: z.coerce.number().int().min(0).optional(),
});

export const focusStatsSchema = z.object({
  from: zDate.optional(),
  to: zDate.optional(),
  granularity: z.enum(['day']).optional().default('day'),
});