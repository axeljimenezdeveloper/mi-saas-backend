// src/modules/company/company.service.ts
// Logica de negocio del modulo company.
// - createOnboarding: crea Company + actualiza User.companyId en transaccion.
// - getByUser: devuelve la Company del User, o 404 ONBOARDING_REQUIRED si no tiene.
// - update: actualiza la Company del User.

import { db } from '../../prisma/db.js';
import { notify } from '../notifications/notification.service.js';
import type { OnboardingInput, UpdateCompanyInput } from './company.types.js';

// ─── Tipos de fila Prisma (runtime) ─────────────────────────

interface PrismaCompanyRow {
  id: string;
  name: string;
  rif: string;
  address: string;
  currency: 'VES' | 'USD';
  defaultIva: string;
  businessType: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

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

interface PrismaCompanyDelegate {
  where: (w: Record<string, unknown>) => {
    first: () => Promise<PrismaCompanyRow | null>;
    update: (d: Record<string, unknown>) => Promise<PrismaCompanyRow>;
  };
  create: (d: Record<string, unknown>) => Promise<PrismaCompanyRow>;
}

interface PrismaUserDelegate {
  where: (w: Record<string, unknown>) => {
    first: () => Promise<PrismaUserRow | null>;
    update: (d: Record<string, unknown>) => Promise<PrismaUserRow>;
  };
}

interface OrmRoot {
  orm: {
    public: {
      Company: PrismaCompanyDelegate;
      User: PrismaUserDelegate;
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

export interface CompanyPublic {
  id: string;
  name: string;
  rif: string;
  address: string;
  currency: 'VES' | 'USD';
  defaultIva: string;
  businessType: string;
  createdAt: string;
  updatedAt: string;
}

function toCompanyPublic(c: PrismaCompanyRow): CompanyPublic {
  return {
    id: c.id,
    name: c.name,
    rif: c.rif,
    address: c.address,
    currency: c.currency,
    defaultIva: c.defaultIva,
    businessType: c.businessType,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
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

// ─── Casos de uso ───────────────────────────────────────────

/**
 * Onboarding: crea la Company y la asocia al User en una transaccion.
 * Si el User ya tiene companyId, lanza 409 ALREADY_CONFIGURED.
 * Errores de unicidad (rif) llegan al errorMiddleware que los mapea a 409 CONFLICT.
 */
export async function createOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<CompanyPublic> {
  const result = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as OrmRoot;
    const User = tx.orm.public.User;
    const Company = tx.orm.public.Company;

    const user = await User.where({ id: userId }).first();
    if (!user) {
      throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }
    if (user.companyId) {
      throw makeHttpError(409, 'ALREADY_CONFIGURED', 'El usuario ya tiene una empresa configurada');
    }

    const company = await Company.create({
      name: input.name,
      rif: input.rif,
      address: input.address,
      currency: input.currency,
      defaultIva: input.defaultIva,
      businessType: input.businessType,
    });

    await User.where({ id: userId }).update({ companyId: company.id });

    return toCompanyPublic(company);
  });

  const companyPublic = result as CompanyPublic;

  // Notificacion de bienvenida (fire-and-forget, no rompe si falla)
  await notify({
    userId,
    companyId: companyPublic.id,
    category: 'system',
    title: `Bienvenido a Vendra, ${companyPublic.name}`,
    description: 'Tu empresa se configuro correctamente. Explora el dashboard para empezar.',
    actionUrl: '/dashboard',
  });

  return companyPublic;
}

/** Devuelve la Company del User, o 404 ONBOARDING_REQUIRED si no tiene. */
export async function getByUser(userId: string): Promise<CompanyPublic> {
  const root = db as unknown as OrmRoot;
  const User = root.orm.public.User;
  const Company = root.orm.public.Company;

  const user = await User.where({ id: userId }).first();
  if (!user) {
    throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  }
  if (!user.companyId) {
    throw makeHttpError(404, 'ONBOARDING_REQUIRED', 'El usuario no tiene empresa configurada');
  }

  const company = await Company.where({ id: user.companyId }).first();
  if (!company) {
    throw makeHttpError(404, 'COMPANY_NOT_FOUND', 'Empresa no encontrada');
  }

  return toCompanyPublic(company);
}

/** Actualiza la Company del User. Mapea companyName -> name. */
export async function update(
  userId: string,
  input: UpdateCompanyInput,
): Promise<CompanyPublic> {
  const root = db as unknown as OrmRoot;
  const User = root.orm.public.User;
  const Company = root.orm.public.Company;

  const user = await User.where({ id: userId }).first();
  if (!user) {
    throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  }
  if (!user.companyId) {
    throw makeHttpError(404, 'ONBOARDING_REQUIRED', 'El usuario no tiene empresa configurada');
  }

  const data: Record<string, unknown> = {
    name: input.companyName,
    rif: input.rif,
    currency: input.currency,
    defaultIva: input.defaultIva,
  };
  if (input.address !== undefined) {
    data.address = input.address;
  }

  const company = await Company.where({ id: user.companyId }).update(data);
  return toCompanyPublic(company);
}