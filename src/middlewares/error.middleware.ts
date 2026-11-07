// src/middlewares/error.middleware.ts
// Error handler global. Debe ir registrado DESPUES de todas las rutas en app.ts.
// Express lo invoca automaticamente cuando un handler llama next(err)
// o cuando se lanza una excepcion sincrona en un handler.

import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '../types/index.js';
import { mapPrismaError } from '../utils/prisma-errors.js';
import { env } from '../config/env.js';

/** Errores "de aplicacion" que ya vienen con status HTTP y body ApiError. */
interface HttpLikeError {
  status?: number;
  body?: ApiError;
}

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  // 1. Errores reconocibles de Prisma
  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    res.status(prismaMapped.status).json({
      success: false,
      data: null,
      error: prismaMapped.body,
    });
    return;
  }

  // 2. Errores de aplicacion que ya traen status/body (los lanzaremos desde services)
  const maybe = err as HttpLikeError;
  if (typeof maybe.status === 'number' && maybe.body) {
    res.status(maybe.status).json({
      success: false,
      data: null,
      error: maybe.body,
    });
    return;
  }

  // 3. Fallback: error no controlado -> 500
  const error: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
  if (env.NODE_ENV !== 'production') {
    error.details = err instanceof Error ? err.message : String(err);
  }
  res.status(500).json({ success: false, data: null, error });
};