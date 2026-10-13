import { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export function serializeUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}