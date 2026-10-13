import { z } from 'zod';

const entitySchema = z.object({ id: z.string() }).passthrough();

export const syncSchema = z.object({
  deviceId: z.string().min(1).max(128),
  cursor: z.coerce.number().int().min(0).optional().default(0),
  entities: z
    .object({
      lists: z.array(entitySchema).optional(),
      folders: z.array(entitySchema).optional(),
      tags: z.array(entitySchema).optional(),
      tasks: z.array(entitySchema).optional(),
      habits: z.array(entitySchema).optional(),
      habitRecords: z.array(entitySchema).optional(),
      focusSessions: z.array(entitySchema).optional(),
      settings: z.record(z.any()).nullable().optional(),
    })
    .optional()
    .default({}),
  tombstones: z.array(z.object({ type: z.string(), id: z.string() })).optional().default([]),
});
export type SyncDto = z.infer<typeof syncSchema>;