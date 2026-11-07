// src/modules/billing/billing.controller.ts
// Handlers HTTP del modulo billing. Todos requieren req.user (authMiddleware).
//
// Nota: en @types/express@5, req.params tipa como Record<string, string | string[]>.
// Extraemos id con un cast puntual (getIdParam).
// req.query es read-only en Express 5; validateQuery deja el parsed en res.locals.query.

import type { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import type { AuthTokenPayload } from '../../utils/jwt.js';
import { env } from '../../config/env.js';
import { generateInvoicePdf } from '../../utils/pdfGenerator.js';
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

// ─── Paso 6: PDF ────────────────────────────────────────────
// El frontend tiene dos formas de consumir el PDF:
//   1. Directo: <iframe src={`/api/invoices/${id}/pdf?token=...`}>
//      (requiere adjuntar el token en query string; no soportado en MVP)
//   2. Blob: fetch con Authorization header + URL.createObjectURL (recomendado)
// El campo invoice.pdfUrl se persiste como metadata/referencia; la ruta
// publica /uploads/invoices/*.pdf se sirve via express.static (ver app.ts).

export async function getPdfHandler(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;
    const invoiceId = getIdParam(req);

    const data = await billingService.getForPdf(userId, invoiceId);
    const pdfBuffer = await generateInvoicePdf({
      invoice: {
        id: data.invoice.id,
        number: data.invoice.number,
        date: data.invoice.date,
        client: data.invoice.client,
        total: data.invoice.total,
        status: data.invoice.status,
      },
      company: data.company,
      items: data.items,
    });

    // Persistir en disco: UPLOAD_DIR/FAC-YYYY-NNNN.pdf
    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${data.invoice.number}.pdf`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, pdfBuffer);

    // Actualizar pdfUrl en DB (ruta publica relativa)
    const pdfUrl = `/uploads/invoices/${filename}`;
    await billingService.updatePdfUrl(userId, invoiceId, pdfUrl);

    // Servir como descarga inline
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.status(200).end(pdfBuffer);
  } catch (err) {
    next(err);
  }
}