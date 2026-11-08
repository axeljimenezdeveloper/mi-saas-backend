// src/modules/notifications/notification.routes.ts
// Router de /api/notifications. Auth obligatoria en todas las rutas.

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateQuery } from '../../middlewares/validate.middleware.js';
import { listNotificationsQuerySchema } from './notification.types.js';
import {
  listHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  removeHandler,
  clearAllHandler,
} from './notification.controller.js';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get(
  '/',
  validateQuery(listNotificationsQuerySchema),
  listHandler,
);

// Rutas especificas ANTES de las que tienen :id
notificationsRouter.patch('/read-all', markAllAsReadHandler);
notificationsRouter.patch('/:id/read', markAsReadHandler);
notificationsRouter.delete('/', clearAllHandler);
notificationsRouter.delete('/:id', removeHandler);