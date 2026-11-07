// src/server.ts
// Punto de entrada real del backend. Hace listen() y registra handlers
// de SIGTERM/SIGINT para cerrar el servidor limpiamente (Docker, Railway).
// No importar este archivo desde tests: importar app.ts en su lugar.

import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`[vendra-backend] Listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Graceful shutdown: deja de aceptar conexiones nuevas, espera a que se
 * cierren las existentes (max 10s), luego exit(0). Si no termina en 10s,
 * forza exit(1).
 */
function shutdown(signal: string): void {
  console.log(`[vendra-backend] ${signal} received, closing server...`);

  server.close((err) => {
    if (err) {
      console.error('[vendra-backend] Error during shutdown:', err);
      process.exit(1);
    }
    console.log('[vendra-backend] Server closed gracefully');
    process.exit(0);
  });

  // Timeout forzado
  setTimeout(() => {
    console.error('[vendra-backend] Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));