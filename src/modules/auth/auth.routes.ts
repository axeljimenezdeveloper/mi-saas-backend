// src/modules/auth/auth.routes.ts
// Router de /api/auth. Aplica validateBody con los schemas Zod
// (registerSchema del backend, loginSchema del frontend reutilizado).

import { Router } from 'express';
import { loginSchema } from '../../schemas/index.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { registerSchema } from './auth.types.js';
import { registerHandler, loginHandler, meHandler } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), registerHandler);
authRouter.post('/login', validateBody(loginSchema), loginHandler);
authRouter.get('/me', authMiddleware, meHandler);