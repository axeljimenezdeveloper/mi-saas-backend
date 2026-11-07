// src/modules/company/company.types.ts
// Tipos e input schemas del modulo company.
// OnboardingInput reutiliza onboardingSchema del frontend (R15).
// UpdateCompanyInput reutiliza settingsSchema del frontend.

import { z } from 'zod';
import {
  onboardingSchema,
  settingsSchema,
} from '../../schemas/index.js';

export const onboardingInputSchema = onboardingSchema;
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

export const updateCompanyInputSchema = settingsSchema;
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;