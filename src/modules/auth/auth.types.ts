// src/modules/auth/auth.types.ts
// Tipos e input schemas del modulo auth.
// loginSchema se reutiliza desde ../../schemas (R15). Register es
// backend-only porque el frontend actual no tiene pagina de registro.

import { z } from 'zod';
import type { LoginFormData } from '../../schemas/index.js';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'El correo es obligatorio' })
    .email({ error: 'Ingresa un correo valido' }),
  password: z
    .string()
    .min(6, { error: 'La contrasena debe tener al menos 6 caracteres' }),
  name: z
    .string()
    .trim()
    .min(1, { error: 'El nombre es obligatorio' })
    .max(100, { error: 'El nombre no puede superar 100 caracteres' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = LoginFormData;