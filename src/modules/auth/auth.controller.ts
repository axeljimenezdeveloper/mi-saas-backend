// src/modules/auth/auth.controller.ts
// Handlers HTTP del modulo auth. Cada handler:
//   1. Extrae el input de req.body o req.user
//   2. Llama al service
//   3. Construye ApiResponse y responde
//   4. Si hay error, lo delega a errorMiddleware via next(err)
//
// El cast de `req` a `AuthedRequest` es necesario porque el authMiddleware
// adjunta `req.user` en runtime pero el tipo de Request de Express no lo
// conoce. Se evita module augmentation global por seguridad entre libs.

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, UserPublic } from '../../types/index.js';
import type { AuthResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import type { RegisterInput, LoginInput } from './auth.types.js';
import * as authService from './auth.service.js';

type AuthedRequest = Request & { user?: AuthTokenPayload };

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as RegisterInput;
    const data = await authService.register(input);
    const body: ApiResponse<AuthResponse> = { success: true, data, error: null };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as LoginInput;
    const data = await authService.login(input);
    const body: ApiResponse<AuthResponse> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function meHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing authenticated user' },
      });
      return;
    }
    const data = await authService.me(userId);
    const body: ApiResponse<UserPublic> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}