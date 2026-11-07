// src/modules/inventory/inventory.types.ts
// Tipos e input schemas del modulo inventory.
//
// createProductSchema reutiliza productSchema del frontend (R15).
//
// updateProductSchema se define independiente porque Zod 4 no permite
// .partial() sobre schemas con refinements (productSchema termina con
// superRefine para validar stock). En un update parcial no queremos exigir
// stock ni reejecutar el refinement de tipo: cada campo es opcional.
// La logica de normalizacion (SKU upper, stock '' -> null, service -> 0)
// vive en inventory.service.ts.

import { z } from 'zod';
import { productSchema } from '../../schemas/index.js';

export const createProductSchema = productSchema;
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .min(3)
    .max(100)
    .optional(),
  sku: z.string().optional(),
  category: z
    .enum(['electronics', 'clothing', 'food', 'home', 'beauty', 'other'])
    .optional(),
  type: z.enum(['physical', 'digital', 'service']).optional(),
  price: z.number().positive().max(10000000).optional(),
  stock: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  taxable: z.boolean().optional(),
  featured: z.boolean().optional(),
});

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