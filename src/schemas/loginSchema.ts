import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'El correo es obligatorio' })
    .email({ error: 'Ingresa un correo válido' }),
  password: z
    .string()
    .min(1, { error: 'La contraseña es obligatoria' })
    .min(6, { error: 'La contraseña debe tener al menos 6 caracteres' }),
});

export type LoginFormData = z.infer<typeof loginSchema>;