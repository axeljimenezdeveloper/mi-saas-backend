// src/middlewares/validate.middleware.ts
// Genera un middleware Express que valida req.body contra un schema Zod.
// - Si falla: responde 400 con { success: false, error: { code: 'VALIDATION_ERROR', details } }
// - Si pasa: reemplaza req.body por el resultado parseado (datos normalizados)
//   y llama next().

import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: result.error.issues,
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}