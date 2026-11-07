// src/middlewares/validate.middleware.ts
// Genera middlewares Express que validan req.body / req.query contra un schema Zod.
// - Si falla: responde 400 con { success: false, error: { code: 'VALIDATION_ERROR', details } }
// - Si pasa: reemplaza req.<target> por el resultado parseado y llama next().

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
          message: 'Request body validation failed',
          details: result.error.issues,
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request query validation failed',
          details: result.error.issues,
        },
      });
      return;
    }
    // req.query en Express 5 es read-only; se asigna el parseado en res.locals.
    res.locals.query = result.data;
    next();
  };
}