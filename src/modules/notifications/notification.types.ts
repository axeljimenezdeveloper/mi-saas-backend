// src/modules/notifications/notification.types.ts
// Schemas Zod y tipos del modulo notifications.

import { z } from 'zod';

export const notificationCategories = [
  'system',
  'inventory',
  'billing',
  'auth',
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  read: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  category: z.enum(notificationCategories).optional(),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;