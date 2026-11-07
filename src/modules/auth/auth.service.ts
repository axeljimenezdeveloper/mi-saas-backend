// src/modules/auth/auth.service.ts
// Logica de negocio del modulo auth: register, login, me.
// No conoce Express: recibe inputs tipados y devuelve entidades tipadas
// o lanza errores con { status, body: ApiError } que errorMiddleware captura.

import { db } from '../../prisma/db.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signToken } from '../../utils/jwt.js';
import type { AuthResponse, UserPublic, UserRole } from '../../types/index.js';
import type { RegisterInput, LoginInput } from './auth.types.js';

// ─── Helpers ─────────────────────────────────────────────────

interface PrismaUserRow {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'CASHIER';
  companyId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PrismaUserDelegate {
  where: (w: Record<string, unknown>) => {
    first: () => Promise<PrismaUserRow | null>;
    update: (d: Record<string, unknown>) => Promise<PrismaUserRow>;
    delete: () => Promise<unknown>;
  };
  create: (d: Record<string, unknown>) => Promise<PrismaUserRow>;
}

function getUserDelegate(): PrismaUserDelegate {
  // Prisma 8 (RC) expone el cliente en db.orm.public.<Model> en runtime,
  // pero el tipo Sql de postgres() no lo declara. Casteamos aqui.
  return (db as unknown as { orm: { public: { User: PrismaUserDelegate } } })
    .orm.public.User;
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toUserPublic(u: PrismaUserRow): UserPublic {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    companyId: u.companyId,
    createdAt: toIso(u.createdAt),
    updatedAt: toIso(u.updatedAt),
  };
}

function makeHttpError(
  status: number,
  code: string,
  message: string,
): Error & { status: number; body: { code: string; message: string } } {
  const err = new Error(message) as Error & {
    status: number;
    body: { code: string; message: string };
  };
  err.status = status;
  err.body = { code, message };
  return err;
}

// ─── Casos de uso ────────────────────────────────────────────

/**
 * Registra un nuevo usuario. El User nace sin Company (companyId: null);
 * la Company se crea luego via POST /api/company/onboarding (Paso 3).
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const User = getUserDelegate();

  const existing = await User.where({ email: input.email }).first();
  if (existing) {
    throw makeHttpError(409, 'EMAIL_TAKEN', 'El correo ya esta registrado');
  }

  const password = await hashPassword(input.password);
  const user = await User.create({
    email: input.email,
    password,
    name: input.name,
    role: 'ADMIN',
    companyId: null,
  });

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
    companyId: user.companyId,
  });

  return { token, user: toUserPublic(user) };
}

/** Valida credenciales y devuelve token + user publico. */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const User = getUserDelegate();

  const user = await User.where({ email: input.email }).first();
  if (!user) {
    throw makeHttpError(401, 'INVALID_CREDENTIALS', 'Credenciales invalidas');
  }

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) {
    throw makeHttpError(401, 'INVALID_CREDENTIALS', 'Credenciales invalidas');
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
    companyId: user.companyId,
  });

  return { token, user: toUserPublic(user) };
}

/** Devuelve el UserPublic del usuario autenticado. */
export async function me(userId: string): Promise<UserPublic> {
  const User = getUserDelegate();

  const user = await User.where({ id: userId }).first();
  if (!user) {
    throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  }

  return toUserPublic(user);
}