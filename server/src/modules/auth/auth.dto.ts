import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(64).optional(),
  deviceId: z.string().min(1).max(128),
  platform: z.string().min(1).max(32),
  appVersion: z.string().max(64).optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().min(1).max(128),
  platform: z.string().min(1).max(32),
  appVersion: z.string().max(64).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  deviceId: z.string().min(1).max(128).optional(),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  all: z.coerce.boolean().optional(),
  refreshToken: z.string().min(1).optional(),
});
export type LogoutDto = z.infer<typeof logoutSchema>;