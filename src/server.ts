// src/server.ts
// Punto de entrada real del backend. Hace listen().
// No importar este archivo desde tests: importar app.ts en su lugar.

import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`[vendra-backend] Listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});