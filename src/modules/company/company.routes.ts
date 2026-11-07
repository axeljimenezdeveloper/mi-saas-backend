// src/modules/company/company.routes.ts
// Router de /api/company. Todas las rutas requieren authMiddleware.
// Validacion de body con los schemas reutilizados (onboarding, settings).

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  onboardingInputSchema,
  updateCompanyInputSchema,
} from './company.types.js';
import {
  onboardingHandler,
  getHandler,
  updateHandler,
} from './company.controller.js';

export const companyRouter = Router();

// Auth obligatoria en todas las rutas del modulo
companyRouter.use(authMiddleware);

companyRouter.post(
  '/onboarding',
  validateBody(onboardingInputSchema),
  onboardingHandler,
);

companyRouter.get('/', getHandler);

companyRouter.put(
  '/',
  validateBody(updateCompanyInputSchema),
  updateHandler,
);