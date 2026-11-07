// src/utils/prisma-errors.ts
// Mapea errores de DB a codigos HTTP + ApiError.
// Prisma 7 usa codigos P20xx; Prisma 8 (RC) expone errores raw del driver pg,
// que usan SQLSTATE (23505, 23503, ...). Ambos se mapean aqui.

import type { ApiError } from '../types/index.js';

export interface DbErrorLike {
  code?: string;
  message?: string;
  meta?: unknown;
  constraint?: string;
  detail?: string;
}

interface MappedError {
  status: number;
  code: string;
  message: string;
}

const DB_ERROR_MAP: Record<string, MappedError> = {
  // Prisma Client codes (Prisma 7 y anteriores)
  P2002: { status: 409, code: 'CONFLICT', message: 'Unique constraint violation' },
  P2003: { status: 409, code: 'FOREIGN_KEY_CONFLICT', message: 'Foreign key constraint failed' },
  P2014: { status: 400, code: 'RELATION_VIOLATION', message: 'Relation violation' },
  P2016: { status: 400, code: 'QUERY_ERROR', message: 'Query interpretation error' },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'Record not found' },
  P2021: { status: 500, code: 'TABLE_NOT_FOUND', message: 'Table does not exist' },
  P2022: { status: 500, code: 'COLUMN_NOT_FOUND', message: 'Column does not exist' },
  // PostgreSQL SQLSTATE (Prisma 8 RC, driver pg raw)
  '23505': { status: 409, code: 'CONFLICT', message: 'Unique constraint violation' },
  '23503': { status: 409, code: 'FOREIGN_KEY_CONFLICT', message: 'Foreign key constraint failed' },
  '23502': { status: 400, code: 'NOT_NULL_VIOLATION', message: 'Not-null constraint violation' },
  '23514': { status: 400, code: 'CHECK_VIOLATION', message: 'Check constraint violation' },
  '23P01': { status: 409, code: 'EXCLUSION_VIOLATION', message: 'Exclusion constraint violation' },
};

/**
 * Devuelve { status, body: ApiError } si `error` es reconocible (Prisma o PostgreSQL),
 * o `null` si no lo es.
 */
export function mapPrismaError(
  error: DbErrorLike | unknown,
): { status: number; body: ApiError } | null {
  if (typeof error !== 'object' || error === null) return null;

  const code = (error as DbErrorLike).code;
  if (typeof code !== 'string') return null;

  const mapped = DB_ERROR_MAP[code];
  if (!mapped) return null;

  const err = error as DbErrorLike;
  const details: Record<string, unknown> = {};
  if (err.constraint) details.constraint = err.constraint;
  if (err.detail) details.detail = err.detail;

  const body: ApiError = {
    code: mapped.code,
    message: mapped.message,
  };
  if (Object.keys(details).length > 0) {
    body.details = details;
  }

  return { status: mapped.status, body };
}