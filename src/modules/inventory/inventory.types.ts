// src/modules/inventory/inventory.types.ts
// Tipos e input schemas del modulo inventory.
// - createProductSchema / updateProductSchema reutilizan productSchema del frontend (R15).
// - listProductsQuerySchema es backend-only (query string parsing).

import { z } from 'zod';
import { productSchema } from '../../schemas/index.js';

export const createProductSchema = productSchema;
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = productSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  category: z
    .enum(['electronics', 'clothing', 'food', 'home', 'beauty', 'other'])
    .optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;