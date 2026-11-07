import { z } from 'zod';

const RIF_REGEX = /^[VEJPG]-\d{8,9}-\d$/i;

export const onboardingSchema = z.object({
  // Paso 1: datos de la empresa
  name: z
    .string()
    .trim()
    .min(1, { error: 'El nombre de la empresa es obligatorio' })
    .min(3, { error: 'Debe tener al menos 3 caracteres' })
    .max(100, { error: 'El nombre no puede superar 100 caracteres' }),
  rif: z
    .string()
    .trim()
    .min(1, { error: 'El RIF es obligatorio' })
    .regex(RIF_REGEX, { error: 'Formato invalido. Ej: J-12345678-9' }),
  address: z
    .string()
    .trim()
    .min(1, { error: 'La direccion es obligatoria' })
    .max(200, { error: 'La direccion no puede superar 200 caracteres' }),

  // Paso 2: preferencias
  currency: z.enum(['VES', 'USD']),
  defaultIva: z.enum(['0', '8', '16']),
  businessType: z.enum(['retail', 'food', 'services', 'other'], {
    error: 'Debes seleccionar un tipo de negocio',
  }),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

/** Schema parcial para validar solo el paso 1. */
export const onboardingStep1Schema = onboardingSchema.pick({
  name: true,
  rif: true,
  address: true,
});

/** Schema parcial para validar solo el paso 2. */
export const onboardingStep2Schema = onboardingSchema.pick({
  currency: true,
  defaultIva: true,
  businessType: true,
});

export type OnboardingStep1Data = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2Data = z.infer<typeof onboardingStep2Schema>;