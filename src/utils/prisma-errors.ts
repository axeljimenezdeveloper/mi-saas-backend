// src/utils/prisma-errors.ts
// Mapea errores del cliente Prisma a codigos HTTP + ApiError.
// Se usa en el error.middleware para devolver respuestas consistentes.

import type { ApiError } from '../types/index.js';

export interface PrismaErrorLike {
  code?: string;
  message?: string;
  meta?: unknown;
}

interface MappedError {
  status: number;
  code: string;
  message: string;
}

const PRISMA_ERROR_MAP: Record<string, MappedError> = {
  // Unique constraint
  P2002: { status: 409, code: 'CONFLICT', message: 'Unique constraint violation' },
  // Foreign key constraint
  P2003: { status: 409, code: 'FOREIGN_KEY_CONFLICT', message: 'Foreign key constraint failed' },
  // Relation violation (e.g. required relation missing)
  P2014: { status: 400, code: 'RELATION_VIOLATION', message: 'Relation violation' },
  // Query interpretation error
  P2016: { status: 400, code: 'QUERY_ERROR', message: 'Query interpretation error' },
  // Record not found
  P2025: { status: 404, code: 'NOT_FOUND', message: 'Record not found' },
  // Table does not exist (migracion no aplicada)
  P2021: { status: 500, code: 'TABLE_NOT_FOUND', message: 'Table does not exist' },
  // Column does not exist (contrato desincronizado)
  P2022: { status: 500, code: 'COLUMN_NOT_FOUND', message: 'Column does not exist' },
};

/**
 * Devuelve el status HTTP y el body ApiError correspondientes
 * si `error` es un error reconocible de Prisma; `null` si no.
 */
export function mapPrismaError(
  error: PrismaErrorLike | unknown,
): { status: number; body: ApiError } | null {
  if (typeof error !== 'object' || error === null) return null;

  const code = (error as PrismaErrorLike).code;
  if (typeof code !== 'string') return null;

  const mapped = PRISMA_ERROR_MAP[code];
  if (!mapped) return null;

  const meta = (error as PrismaErrorLike).meta;
  const body: ApiError = {
    code: mapped.code,
    message: mapped.message,
  };
  if (meta !== undefined) {
    body.details = meta;
  }

  return { status: mapped.status, body };
}