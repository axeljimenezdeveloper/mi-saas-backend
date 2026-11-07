// src/modules/billing/billing.routes.ts
// Router de /api/invoices. authMiddleware global + validadores por ruta.

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  validateBody,
  validateQuery,
} from '../../middlewares/validate.middleware.js';
import {
  createInvoiceSchema,
  updateStatusSchema,
  listInvoicesQuerySchema,
} from './billing.types.js';
import {
  listHandler,
  getHandler,
  createHandler,
  updateStatusHandler,
  deleteHandler,
  getPdfHandler,
} from './billing.controller.js';

export const billingRouter = Router();

billingRouter.use(authMiddleware);

billingRouter.get('/', validateQuery(listInvoicesQuerySchema), listHandler);
billingRouter.post('/', validateBody(createInvoiceSchema), createHandler);
billingRouter.get('/:id/pdf', getPdfHandler);
billingRouter.get('/:id', getHandler);
billingRouter.patch(
  '/:id/status',
  validateBody(updateStatusSchema),
  updateStatusHandler,
);
billingRouter.delete('/:id', deleteHandler);