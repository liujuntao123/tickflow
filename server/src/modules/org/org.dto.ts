import { z } from 'zod';

const name = z.string().min(1).max(120);
const color = z.number().int().min(0).max(0xffffff);

export const folderCreateSchema = z.object({ name, color: color.optional() });
export const folderUpdateSchema = z.object({
  name: name.optional(),
  color: color.nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export const folderDeleteQuerySchema = z.object({ strategy: z.enum(['inbox', 'cascade']).optional() });

export const reorderSchema = z.object({ orderedIds: z.array(z.string().uuid()).max(2000) });

export const listCreateSchema = z.object({
  name,
  folderId: z.string().uuid().nullable().optional(),
  color: color.nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
});
export const listUpdateSchema = z.object({
  name: name.optional(),
  folderId: z.string().uuid().nullable().optional(),
  color: color.nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isArchived: z.boolean().optional(),
});
export const listQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export const archiveSchema = z.object({ archived: z.boolean().optional() });

export const tagCreateSchema = z.object({ name, color: color.optional() });
export const tagUpdateSchema = z.object({
  name: name.optional(),
  color: color.nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});
export const tagMergeSchema = z.object({ fromId: z.string().uuid(), toId: z.string().uuid() });