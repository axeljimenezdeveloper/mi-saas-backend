// src/modules/inventory/inventory.routes.ts
// Router de /api/products. authMiddleware global + validadores por ruta.

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  validateBody,
  validateQuery,
} from '../../middlewares/validate.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from './inventory.types.js';
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  deleteHandler,
} from './inventory.controller.js';

export const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);

inventoryRouter.get('/', validateQuery(listProductsQuerySchema), listHandler);
inventoryRouter.post('/', validateBody(createProductSchema), createHandler);
inventoryRouter.get('/:id', getHandler);
inventoryRouter.put('/:id', validateBody(updateProductSchema), updateHandler);
inventoryRouter.delete('/:id', deleteHandler);