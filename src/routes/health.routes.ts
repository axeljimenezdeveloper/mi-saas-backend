// src/routes/health.routes.ts
// Ruta publica /health. Sirve para:
//   - Verificar que el proceso esta vivo.
//   - Verificar que el servidor HTTP responde.
// No toca la base de datos (para no depender de Neon en liveness checks).

import { Router } from 'express';
import type { ApiResponse } from '../types/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: ApiResponse<{ status: string; timestamp: string }> = {
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
    error: null,
  };
  res.status(200).json(body);
});