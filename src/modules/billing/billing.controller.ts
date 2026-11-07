// src/modules/billing/billing.controller.ts
// Handlers HTTP del modulo billing. Todos requieren req.user (authMiddleware).
//
// Nota: en @types/express@5, req.params tipa como Record<string, string | string[]>.
// Extraemos id con un cast puntual (getIdParam).
// req.query es read-only en Express 5; validateQuery deja el parsed en res.locals.query.

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import type {
  CreateInvoiceInput,
  UpdateStatusInput,
  ListInvoicesQuery,
} from './billing.types.js';
import type { InvoicePublic } from './billing.service.js';
import * as billingService from './billing.service.js';

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

function getIdParam(req: Request): string {
  const { id } = req.params as { id: string };
  return id;
}

export async function listHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const query = res.locals.query as ListInvoicesQuery;
    const data = await billingService.list(userId, query);
    const body: ApiResponse<PaginatedResponse<InvoicePublic>> = {
      success: true,
      data,
      error: null,
    };
    res.status(200).json(body);
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
    const data = await billingService.getById(userId, getIdParam(req));
    const body: ApiResponse<InvoicePublic> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function createHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const input = req.body as CreateInvoiceInput;
    const data = await billingService.create(userId, input);
    const body: ApiResponse<InvoicePublic> = { success: true, data, error: null };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
}

export async function updateStatusHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const input = req.body as UpdateStatusInput;
    const data = await billingService.updateStatus(userId, getIdParam(req), input);
    const body: ApiResponse<InvoicePublic> = { success: true, data, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    await billingService.remove(userId, getIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}