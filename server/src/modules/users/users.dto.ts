import { z } from 'zod';

export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});