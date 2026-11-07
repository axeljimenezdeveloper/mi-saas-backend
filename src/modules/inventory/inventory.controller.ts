// src/modules/inventory/inventory.controller.ts
// Handlers HTTP del modulo inventory. Todos requieren req.user (authMiddleware).
//
// Nota: en @types/express@5, req.params tipa como Record<string, string | string[]>.
// Extraemos id con un cast puntual para evitar el string[] y mantenerlo limpio.

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from './inventory.types.js';
import type { ProductPublic } from './inventory.service.js';
import * as inventoryService from './inventory.service.js';

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
    const query = res.locals.query as ListProductsQuery;
    const data = await inventoryService.list(userId, query);
    const body: ApiResponse<PaginatedResponse<ProductPublic>> = {
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
    const data = await inventoryService.getById(userId, getIdParam(req));
    const body: ApiResponse<ProductPublic> = { success: true, data, error: null };
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
    const input = req.body as CreateProductInput;
    const data = await inventoryService.create(userId, input);
    const body: ApiResponse<ProductPublic> = { success: true, data, error: null };
    res.status(201).json(body);
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
    const input = req.body as UpdateProductInput;
    const data = await inventoryService.update(userId, getIdParam(req), input);
    const body: ApiResponse<ProductPublic> = { success: true, data, error: null };
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
    await inventoryService.remove(userId, getIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}