// src/utils/jwt.ts
// Firma y verificacion de tokens JWT. Payload tipado con los datos
// minimos que necesitan los middlewares y controllers de la API.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types/index.js';

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

/** Firma un token con el payload dado. Expira segun JWT_EXPIRES_IN del env. */
export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Verifica y decodifica un token. Lanza si es invalido o expirado. */
export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as unknown as AuthTokenPayload;
}