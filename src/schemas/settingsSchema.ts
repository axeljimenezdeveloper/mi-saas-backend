import { z } from 'zod';

export const settingsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, { error: 'El nombre de la empresa es obligatorio' })
    .min(3, { error: 'Debe tener al menos 3 caracteres' }),
  rif: z
    .string()
    .trim()
    .min(1, { error: 'El RIF es obligatorio' })
    .regex(/^[VEJPG]-\d{8,9}-\d$/i, {
      error: 'Formato invalido. Ej: J-12345678-9',
    }),
  address: z.string().optional(),
  currency: z.enum(['VES', 'USD']),
  defaultIva: z.enum(['0', '8', '16']),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;