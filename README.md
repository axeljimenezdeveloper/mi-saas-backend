# Vendra Backend

API REST para la plataforma Vendra - gestion de inventario y facturacion
para PYMES venezolanas. Complementa al frontend React + TypeScript del
mismo proyecto. Proyecto academico para la asignatura Evaluacion de
Proyectos (225) de la Universidad Nacional Abierta (UNA).

> Version actual: **1.2.0** - Node 22 + TypeScript 7 + Express 4 + Prisma 8 RC + PostgreSQL


## Que hace

Backend del SaaS Vendra: expone los endpoints que consumen los modulos de
autenticacion, inventario, facturacion, empresa y notificaciones del
frontend. Autentica con JWT + bcrypt, valida con los mismos schemas Zod
que el frontend (R15 del manual), persiste en PostgreSQL via Prisma ORM 8,
y genera PDFs de facturas con pdfkit.


## Stack

| Capa | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Lenguaje | TypeScript 7 |
| Framework HTTP | Express 4 |
| ORM | Prisma ORM 8 (RC) + PostgreSQL 15+ |
| Validacion | Zod 4 (schemas compartidos con el frontend) |
| Auth | JWT + bcrypt |
| PDF | pdfkit |
| Testing | Vitest 5 + v8 coverage |


## Como ejecutar

1. Instalar dependencias: `npm install`
2. Entorno: `cp .env.example .env` + editar `DATABASE_URL` y `JWT_SECRET` (32+ chars)
3. Generar contrato Prisma: `npx prisma contract emit`
4. Aplicar schema a PostgreSQL: `npx prisma db init`
5. Dev: `npm run dev` â†’ `http://localhost:3000`

## Scripts

| Script | Descripcion |
|---|---|
| `npm run dev` | Servidor con hot reload (tsx watch) |
| `npm run build` | Compila TS a dist/ (excluye tests) |
| `npm start` | Corre la build desde dist/ |
| `npm test` | Vitest en modo watch |
| `npm run test:run` | Vitest one-shot (CI) |
| `npm run test:coverage` | Vitest + cobertura v8 |
| `npm run type-check` | tsc --noEmit |

## Endpoints principales

Todas las rutas requieren `Authorization: Bearer <jwt>` salvo `/api/auth/register`, `/api/auth/login` y `/health`.

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/health` | Health check (sin auth) |
| POST | `/api/auth/register` | Crea usuario |
| POST | `/api/auth/login` | Devuelve JWT + user |
| GET | `/api/auth/me` | Usuario autenticado |
| POST | `/api/company/onboarding` | Crea empresa + asocia al user |
| GET | `/api/company` | Empresa actual |
| PUT | `/api/company` | Actualiza settings |
| GET | `/api/products` | Lista productos paginados |
| POST | `/api/products` | Crea producto (SKU unico por empresa) |
| GET | `/api/products/:id` | Detalle producto |
| PUT | `/api/products/:id` | Actualiza producto |
| DELETE | `/api/products/:id` | Elimina producto |
| GET | `/api/invoices` | Lista facturas |
| POST | `/api/invoices` | Crea factura + descuenta stock (forUpdate) |
| GET | `/api/invoices/:id` | Detalle factura |
| PATCH | `/api/invoices/:id/status` | Cambia estado (PENDING/PAID/OVERDUE) |
| DELETE | `/api/invoices/:id` | Elimina factura (no restaura stock) |
| GET | `/api/invoices/:id/pdf` | Genera PDF (respeta company.currency) |
| GET | `/api/notifications` | Lista notificaciones |
| PATCH | `/api/notifications/:id/read` | Marca una como leida |
| PATCH | `/api/notifications/read-all` | Marca todas como leidas |
| DELETE | `/api/notifications/:id` | Elimina notificacion |
| DELETE | `/api/notifications` | Elimina todas |

## Arquitectura

```text
src/
  config/         env.ts (Zod valida al startup)
  middlewares/    auth (JWT), error, validate (Zod)
  modules/
    auth/         register/login/me + JWT + bcrypt
    company/      onboarding + settings (RIF unico)
    inventory/    CRUD productos (SKU unico por empresa)
    billing/      facturas + stock + PDF (forUpdate)
    notifications/ persistentes, helper notify()
  prisma/         db.ts + contract.json + contract.d.ts (Prisma 8 RC)
  schemas/        Zod compartidos con frontend (R15)
  utils/          hash, jwt, pdfGenerator, prisma-errors
  test/           factories.ts
```


## Tests

```bash
npm run test:run        # 12 tests de billing.service (v1.2.0)
npm run test:coverage   # con cobertura v8 -> coverage/
```

Cubren los fixes de v1.1.0: precio del cliente ignorado (usa product.price),
`forUpdate()` en la validacion de stock, y bloqueo de `OVERDUE -> PENDING`.


## Proyecto academico

Trabajo de la asignatura **Evaluacion de Proyectos (225)** â€” Universidad
Nacional Abierta (UNA), 2026-2.

Autor: **Axel Gabriel Jimenez Malaver**.

Repos relacionados:

- Frontend: `mi-saas-frontend` (React 19 + Vite 8 + Zustand)


## Licencia

Uso academico. Todos los derechos reservados al autor.
