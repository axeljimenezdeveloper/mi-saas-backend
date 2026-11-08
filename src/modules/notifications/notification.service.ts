// src/modules/notifications/notification.service.ts
// Logica de negocio del modulo notifications.
//
// Ownership: cada user ve SOLO sus notificaciones (WHERE userId = current).
// notify(): helper que los demas services llaman fire-and-forget.
//   NUNCA lanza: si falla, se loggea y el flujo del caller continua.

import { db } from '../../prisma/db.js';
import type { PaginatedResponse } from '../../types/index.js';
import type {
  ListNotificationsQuery,
  NotificationCategory,
} from './notification.types.js';

// ─── Tipos de fila Prisma (runtime) ─────────────────────────

interface PrismaNotificationRow {
  id: string;
  userId: string;
  companyId: string;
  category: string;
  title: string;
  description: string | null;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date | string;
}

interface QueryChain<T> {
  first: () => Promise<T | null>;
  all: () => Promise<T[]>;
  update: (d: Record<string, unknown>) => Promise<T>;
  delete: () => Promise<unknown>;
  deleteAll?: () => Promise<unknown>;
}

interface PrismaNotificationDelegate {
  where: (w: Record<string, unknown>) => QueryChain<PrismaNotificationRow>;
  create: (d: Record<string, unknown>) => Promise<PrismaNotificationRow>;
}

interface OrmRoot {
  orm: {
    public: {
      Notification: PrismaNotificationDelegate;
    };
  };
}

// ─── Tipos publicos ─────────────────────────────────────────

export interface NotificationPublic {
  id: string;
  userId: string;
  companyId: string;
  category: string;
  title: string;
  description: string | null;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toNotificationPublic(n: PrismaNotificationRow): NotificationPublic {
  return {
    id: n.id,
    userId: n.userId,
    companyId: n.companyId,
    category: n.category,
    title: n.title,
    description: n.description,
    actionUrl: n.actionUrl,
    read: n.read,
    createdAt: toIso(n.createdAt),
  };
}

function makeHttpError(
  status: number,
  code: string,
  message: string,
): Error & { status: number; body: { code: string; message: string } } {
  const err = new Error(message) as Error & {
    status: number;
    body: { code: string; message: string };
  };
  err.status = status;
  err.body = { code, message };
  return err;
}

function getNotificationDelegate(): PrismaNotificationDelegate {
  return (db as unknown as OrmRoot).orm.public.Notification;
}

// ─── Helper notify() (uso interno de otros services) ────────

export interface NotifyInput {
  userId: string;
  companyId: string;
  category: NotificationCategory;
  title: string;
  description?: string;
  actionUrl?: string;
}

/**
 * Crea una notificacion persistente.
 * NUNCA lanza: si falla, loggea y retorna. Los services lo llaman
 * fire-and-forget DESPUES de su transaccion principal, para que un
 * fallo aqui no rompa el flujo del usuario.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const Notification = getNotificationDelegate();
    await Notification.create({
      userId: input.userId,
      companyId: input.companyId,
      category: input.category,
      title: input.title,
      description: input.description ?? null,
      actionUrl: input.actionUrl ?? null,
      read: false,
    });
  } catch (err) {
    console.error('[notification.notify] failed to create:', err);
  }
}

// ─── Casos de uso ───────────────────────────────────────────

export async function list(
  userId: string,
  query: ListNotificationsQuery,
): Promise<PaginatedResponse<NotificationPublic>> {
  const Notification = getNotificationDelegate();

  const filter: Record<string, unknown> = { userId };
  if (query.read !== undefined) filter.read = query.read;
  if (query.category) filter.category = query.category;

  const all = await Notification.where(filter).all();

  // Orden mas reciente primero
  all.sort((a, b) => toIso(b.createdAt).localeCompare(toIso(a.createdAt)));

  const total = all.length;
  const start = (query.page - 1) * query.pageSize;
  const items = all
    .slice(start, start + query.pageSize)
    .map(toNotificationPublic);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function markAsRead(
  userId: string,
  id: string,
): Promise<NotificationPublic> {
  const Notification = getNotificationDelegate();

  const current = await Notification.where({ id, userId }).first();
  if (!current) {
    throw makeHttpError(
      404,
      'NOTIFICATION_NOT_FOUND',
      'Notificacion no encontrada',
    );
  }

  if (current.read) return toNotificationPublic(current);

  const updated = await Notification.where({ id, userId }).update({
    read: true,
  });
  return toNotificationPublic(updated);
}

export async function markAllAsRead(userId: string): Promise<number> {
  const Notification = getNotificationDelegate();

  const unread = await Notification.where({ userId, read: false }).all();
  let count = 0;
  for (const n of unread) {
    await Notification.where({ id: n.id, userId }).update({ read: true });
    count += 1;
  }
  return count;
}

export async function remove(userId: string, id: string): Promise<void> {
  const Notification = getNotificationDelegate();

  const current = await Notification.where({ id, userId }).first();
  if (!current) {
    throw makeHttpError(
      404,
      'NOTIFICATION_NOT_FOUND',
      'Notificacion no encontrada',
    );
  }

  await Notification.where({ id, userId }).delete();
}

export async function clearAll(userId: string): Promise<number> {
  const Notification = getNotificationDelegate();

  const all = await Notification.where({ userId }).all();
  const count = all.length;

  // deleteAll existe en el prototype del delegate (verificado en introspeccion).
  // Fallback al loop si no existe, por si la version RC cambia.
  const chain = Notification.where({ userId });
  if (typeof chain.deleteAll === 'function') {
    await chain.deleteAll();
  } else {
    for (const n of all) {
      await Notification.where({ id: n.id, userId }).delete();
    }
  }

  return count;
}