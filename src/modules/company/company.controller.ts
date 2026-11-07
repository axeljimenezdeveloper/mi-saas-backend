// src/modules/company/company.controller.ts
// Handlers HTTP del modulo company. Cada handler:
//   1. Extrae userId de req.user (adjuntado por authMiddleware)
//   2. Llama al service
//   3. Construye ApiResponse y responde
//   4. Si hay error, lo delega a errorMiddleware via next(err)

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import type { OnboardingInput, UpdateCompanyInput } from './company.types.js';
import type { CompanyPublic } from './company.service.js';
import * as companyService from './company.service.js';

type AuthedRequest = Request & { user?: AuthTokenPayload };

function getUserId(req: AuthedRequest, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Missing authenticated user' },
    });
    return null;
  }
  return userId;
}

export async function onboardingHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const input = req.body as OnboardingInput;
    const data = await companyService.createOnboarding(userId, input);
    const body: ApiResponse<CompanyPublic> = { success: true, data, error: null };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

export async function getHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const data = await companyService.getByUser(userId);
    const body: ApiResponse<CompanyPublic> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const input = req.body as UpdateCompanyInput;
    const data = await companyService.update(userId, input);
    const body: ApiResponse<CompanyPublic> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}