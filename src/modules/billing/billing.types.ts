// src/modules/billing/billing.types.ts
// Tipos e input schemas del modulo billing.
// - createInvoiceSchema reutiliza invoiceSchema del frontend (R15).
// - updateStatusSchema es backend-only (PATCH status).
// - listInvoicesQuerySchema es backend-only (query string parsing).

import { z } from 'zod';
import { invoiceSchema } from '../../schemas/index.js';

export const createInvoiceSchema = invoiceSchema;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE'], {
    error: 'Estado invalido. Valores permitidos: PENDING, PAID, OVERDUE',
  }),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE']).optional(),
  search: z.string().trim().optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;