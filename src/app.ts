// src/app.ts
// Construye la app Express (sin hacer listen). Esto permite testear con
// supertest en el futuro sin levantar un puerto real.
//
// Orden de middlewares importa:
//   1. cors + json (infra)
//   2. rutas publicas (health)
//   3. rutas protegidas (authMiddleware + routers por dominio)
//   4. 404
//   5. errorMiddleware SIEMPRE al final

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';

export const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Publicas
app.use(healthRouter);

// TODO: mount auth routes (Paso 2)
// app.use('/api/auth', authRouter);

// TODO: mount company routes (Paso 3)
// app.use('/api/company', authMiddleware, companyRouter);

// TODO: mount inventory routes (Paso 4)
// app.use('/api/products', authMiddleware, inventoryRouter);

// TODO: mount billing routes (Paso 5)
// app.use('/api/invoices', authMiddleware, billingRouter);

// 404 para rutas desconocidas
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Error handler SIEMPRE al final
app.use(errorMiddleware);