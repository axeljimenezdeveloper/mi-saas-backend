import { z } from 'zod';

const SKU_REGEX = /^[A-Z0-9-]+$/i;

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: 'El nombre del producto es obligatorio' })
      .min(3, { error: 'Debe tener al menos 3 caracteres' })
      .max(100, { error: 'El nombre no puede superar 100 caracteres' }),
    sku: z
      .string()
      .optional()
      .superRefine((val, ctx) => {
        if (!val || val.trim() === '') return;
        const sku = val.trim();
        if (sku.length < 3) {
          ctx.addIssue({
            code: 'custom',
            message: 'El SKU debe tener al menos 3 caracteres',
          });
          return;
        }
        if (sku.length > 50) {
          ctx.addIssue({
            code: 'custom',
            message: 'El SKU no puede superar 50 caracteres',
          });
          return;
        }
        if (!SKU_REGEX.test(sku)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Solo letras, numeros y guiones (sin espacios ni simbolos)',
          });
          return;
        }
        if (!/[A-Z]/i.test(sku)) {
          ctx.addIssue({
            code: 'custom',
            message: 'El SKU debe contener al menos una letra (no solo numeros)',
          });
          return;
        }
        if (sku.startsWith('-') || sku.endsWith('-')) {
          ctx.addIssue({
            code: 'custom',
            message: 'El SKU no puede empezar ni terminar con guion',
          });
          return;
        }
        if (sku.includes('--')) {
          ctx.addIssue({
            code: 'custom',
            message: 'El SKU no puede tener guiones consecutivos',
          });
        }
      }),
    category: z.enum(
      ['electronics', 'clothing', 'food', 'home', 'beauty', 'other'],
      { error: 'Debes seleccionar una categoria' }
    ),
    type: z.enum(['physical', 'digital', 'service']),
    price: z
      .number({ error: 'El precio unitario es obligatorio' })
      .positive({ error: 'El precio debe ser mayor a cero' })
      .max(10000000, { error: 'El precio no puede superar 10.000.000 Bs.' }),
    stock: z.string(),
    description: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.length <= 500,
        { error: 'La descripcion no puede superar 500 caracteres' }
      ),
    images: z.array(z.string()).default([]),
    active: z.boolean(),
    taxable: z.boolean(),
    featured: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'service') return;

    if (!data.stock || data.stock.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'El stock inicial es obligatorio',
        path: ['stock'],
      });
      return;
    }

    const n = Number(data.stock);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'El stock no puede ser negativo',
        path: ['stock'],
      });
      return;
    }

    if (!Number.isInteger(n)) {
      ctx.addIssue({
        code: 'custom',
        message: 'El stock debe ser un numero entero',
        path: ['stock'],
      });
      return;
    }

    if (n > 999999) {
      ctx.addIssue({
        code: 'custom',
        message: 'El stock no puede superar 999.999 unidades',
        path: ['stock'],
      });
    }
  });

export type ProductFormData = z.infer<typeof productSchema>;