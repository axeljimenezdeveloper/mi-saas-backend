// src/app.ts
// Construye la app Express (sin hacer listen). Esto permite testear con
// supertest en el futuro sin levantar un puerto real.
//
// Orden de middlewares importa:
//   1. cors + json (infra)
//   2. archivos estaticos (/uploads)
//   3. rutas publicas (health, auth/register, auth/login)
//   4. rutas protegidas (authMiddleware + routers por dominio)
//   5. 404
//   6. errorMiddleware SIEMPRE al final

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { companyRouter } from './modules/company/company.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { notificationsRouter } from './modules/notifications/notification.routes.js';

export const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Archivos estaticos: PDFs generados de facturas.
// SEGURIDAD: en produccion esto deberia ir detras de un middleware de auth
// o servirse desde un bucket con URLs firmadas. En MVP las facturas son de
// datos de demo y el nombre FAC-YYYY-NNNN es suficientemente opaco.
const uploadsRoot = path.dirname(path.resolve(process.cwd(), env.UPLOAD_DIR));
app.use('/uploads', express.static(uploadsRoot));

// Publicas
app.use(healthRouter);
app.use('/api/auth', authRouter);

// Protegidas (authMiddleware va dentro de cada router)
app.use('/api/company', companyRouter);
app.use('/api/products', inventoryRouter);
app.use('/api/invoices', billingRouter);
app.use('/api/notifications', notificationsRouter);

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