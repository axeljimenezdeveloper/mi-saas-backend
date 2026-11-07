// src/middlewares/auth.middleware.ts
// Implementacion real del middleware de autenticacion.
//   1. Lee el header Authorization: Bearer <jwt>
//   2. Verifica el token con verifyToken (JWT_SECRET del env)
//   3. Adjunta req.user = payload
//   4. Llama next() si valido, o responde 401 UNAUTHORIZED si no.

import type { RequestHandler } from 'express';
import { verifyToken } from '../utils/jwt.js';
import type { AuthTokenPayload } from '../utils/jwt.js';

type AuthedRequest = Parameters<RequestHandler>[0] & { user?: AuthTokenPayload };

export const authMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Empty bearer token' },
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    (req as AuthedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
};