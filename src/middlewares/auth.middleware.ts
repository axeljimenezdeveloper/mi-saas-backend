// src/middlewares/auth.middleware.ts
// STUB. En el Paso 2 se reemplaza por la implementacion real:
//   1. Lee el header Authorization: Bearer <jwt>
//   2. Verifica el token con JWT_SECRET
//   3. Adjunta req.user = { id, email, role, companyId }
//   4. Llama next() si es valido, o responde 401 UNAUTHORIZED si no.
//
// Se deja como stub ahora para que app.ts (bloque 1.E) ya pueda cablearlo
// en las rutas protegidas sin tocar app.ts despues.

import type { RequestHandler } from 'express';

export const authMiddleware: RequestHandler = (_req, res, _next) => {
  res.status(501).json({
    success: false,
    data: null,
    error: {
      code: 'AUTH_NOT_IMPLEMENTED',
      message: 'Auth middleware is not implemented yet (Paso 2)',
    },
  });
};