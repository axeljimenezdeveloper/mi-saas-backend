// src/utils/prisma-errors.ts
// Mapea errores de DB a codigos HTTP + ApiError.
// Prisma 8 (RC) puede envolver el error de pg en .cause o .meta, por lo que
// buscamos el .code en varios niveles.

import type { ApiError } from '../types/index.js';

export interface DbErrorLike {
  code?: string;
  message?: string;
  meta?: unknown;
  cause?: unknown;
  constraint?: string;
  detail?: string;
}

interface MappedError {
  status: number;
  code: string;
  message: string;
}

const DB_ERROR_MAP: Record<string, MappedError> = {
  P2002: { status: 409, code: 'CONFLICT', message: 'Unique constraint violation' },
  P2003: { status: 409, code: 'FOREIGN_KEY_CONFLICT', message: 'Foreign key constraint failed' },
  P2014: { status: 400, code: 'RELATION_VIOLATION', message: 'Relation violation' },
  P2016: { status: 400, code: 'QUERY_ERROR', message: 'Query interpretation error' },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'Record not found' },
  P2021: { status: 500, code: 'TABLE_NOT_FOUND', message: 'Table does not exist' },
  P2022: { status: 500, code: 'COLUMN_NOT_FOUND', message: 'Column does not exist' },
  '23505': { status: 409, code: 'CONFLICT', message: 'Unique constraint violation' },
  '23503': { status: 409, code: 'FOREIGN_KEY_CONFLICT', message: 'Foreign key constraint failed' },
  '23502': { status: 400, code: 'NOT_NULL_VIOLATION', message: 'Not-null constraint violation' },
  '23514': { status: 400, code: 'CHECK_VIOLATION', message: 'Check constraint violation' },
  '23P01': { status: 409, code: 'EXCLUSION_VIOLATION', message: 'Exclusion constraint violation' },
};

function findErrorCode(error: unknown, depth = 0): string | null {
  if (depth > 3 || typeof error !== 'object' || error === null) return null;

  const e = error as Record<string, unknown>;

  if (typeof e.code === 'string' && e.code.length > 0) {
    return e.code;
  }

  if (e.cause) {
    const fromCause = findErrorCode(e.cause, depth + 1);
    if (fromCause) return fromCause;
  }

  const meta = e.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta.code === 'string') {
    return meta.code;
  }

  return null;
}

export function mapPrismaError(
  error: DbErrorLike | unknown,
): { status: number; body: ApiError } | null {
  const code = findErrorCode(error);
  if (!code) return null;

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