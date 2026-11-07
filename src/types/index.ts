// src/types/index.ts
// Tipos compartidos de la API. No dependen de Prisma ni de Express.

// ─── Error y respuesta de API ────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Respuesta estandar de la API.
 * Union discriminada por `success`: TypeScript estrecha `data`/`error`
 * automaticamente al comprobar `if (res.success)`.
 */
export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiError };

// ─── Paginacion ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Autenticacion ───────────────────────────────────────────

export type UserRole = 'ADMIN' | 'CASHIER';

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  createdAt: string; // ISO 8601 (JSON serializa Date -> string)
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}