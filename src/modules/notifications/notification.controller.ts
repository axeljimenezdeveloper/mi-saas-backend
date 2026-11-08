// src/modules/notifications/notification.controller.ts
// Handlers HTTP del modulo notifications. Todos requieren authMiddleware.

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import type { ListNotificationsQuery } from './notification.types.js';
import type { NotificationPublic } from './notification.service.js';
import * as notificationService from './notification.service.js';

type AuthedRequest = Request & { user?: AuthTokenPayload };

function getUserId(req: AuthedRequest, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Missing authenticated user' },
    });
    return null;
  }
  return userId;
}

function getIdParam(req: Request): string {
  const { id } = req.params as { id: string };
  return id;
}

export async function listHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const query = res.locals.query as ListNotificationsQuery;
    const data = await notificationService.list(userId, query);
    const body: ApiResponse<PaginatedResponse<NotificationPublic>> = {
      success: true,
      data,
      error: null,
    };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function markAsReadHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const data = await notificationService.markAsRead(
      userId,
      getIdParam(req),
    );
    const body: ApiResponse<NotificationPublic> = {
      success: true,
      data,
      error: null,
    };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function markAllAsReadHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const updated = await notificationService.markAllAsRead(userId);
    const body: ApiResponse<{ updated: number }> = {
      success: true,
      data: { updated },
      error: null,
    };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function removeHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    await notificationService.remove(userId, getIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function clearAllHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const removed = await notificationService.clearAll(userId);
    const body: ApiResponse<{ removed: number }> = {
      success: true,
      data: { removed },
      error: null,
    };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}