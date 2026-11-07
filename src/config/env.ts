// src/config/env.ts
// Valida las variables de entorno al arrancar la app.
// Si falta algo o esta mal formado, el proceso termina con un mensaje claro
// en lugar de fallar de forma criptica en runtime (ej. "Database connection
// is required" de Prisma por DATABASE_URL undefined).

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, { error: 'DATABASE_URL es obligatoria' }),
  JWT_SECRET: z.string().min(32, { error: 'JWT_SECRET debe tener al menos 32 caracteres' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads/invoices'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('>>> Invalid environment variables:');
  console.error(parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;