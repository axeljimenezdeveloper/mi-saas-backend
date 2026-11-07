// src/modules/inventory/inventory.service.ts
// Logica de negocio del modulo inventory (CRUD de productos).
// Ownership: todas las queries filtran por companyId del user autenticado.
// Normalizacion SKU: trim + uppercase + '' -> null (resuelve bug latente:
// dos productos con sku:'' chocan contra el unique [companyId, sku] porque
// en PostgreSQL '' es unico, NULL no).
//
// Nota MVP: la busqueda por texto se hace en memoria tras traer todos los
// productos de la empresa. Para volumenes mayores se reemplaza por SQL LIKE/ILIKE.

import { db } from '../../prisma/db.js';
import type { PaginatedResponse } from '../../types/index.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from './inventory.types.js';

// ─── Tipos de fila Prisma (runtime) ──────────────────────────

interface PrismaProductRow {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  type: string;
  price: number | string;
  stock: number;
  description: string | null;
  images: string[];
  active: boolean;
  taxable: boolean;
  featured: boolean;
  companyId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PrismaUserRow {
  id: string;
  companyId: string | null;
}

interface ProductQueryChain {
  first: () => Promise<PrismaProductRow | null>;
  all: () => Promise<PrismaProductRow[]>;
  count: () => Promise<number>;
  update: (d: Record<string, unknown>) => Promise<PrismaProductRow>;
  delete: () => Promise<unknown>;
}

interface PrismaProductDelegate {
  where: (w: Record<string, unknown>) => ProductQueryChain;
  create: (d: Record<string, unknown>) => Promise<PrismaProductRow>;
}

interface PrismaUserDelegate {
  where: (w: Record<string, unknown>) => {
    first: () => Promise<PrismaUserRow | null>;
  };
}

interface OrmRoot {
  orm: {
    public: {
      Product: PrismaProductDelegate;
      User: PrismaUserDelegate;
    };
  };
}

// ─── Helpers ─────────────────────────────────────────────────

export interface ProductPublic {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  type: string;
  price: number;
  stock: number;
  description: string | null;
  images: string[];
  active: boolean;
  taxable: boolean;
  featured: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

function toProductPublic(p: PrismaProductRow): ProductPublic {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    type: p.type,
    price: toNumber(p.price),
    stock: p.stock,
    description: p.description,
    images: p.images,
    active: p.active,
    taxable: p.taxable,
    featured: p.featured,
    companyId: p.companyId,
    createdAt: toIso(p.createdAt),
    updatedAt: toIso(p.updatedAt),
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

/** trim + uppercase + vacio -> null. */
function normalizeSku(sku: string | undefined | null): string | null {
  if (sku === undefined || sku === null) return null;
  const trimmed = sku.trim().toUpperCase();
  return trimmed === '' ? null : trimmed;
}

function parseStock(type: string, stock: string | undefined): number {
  if (type === 'service') return 0;
  if (!stock) return 0;
  const n = Number(stock);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Verifica que el user tenga empresa configurada y devuelve su companyId. */
async function resolveCompanyId(userId: string): Promise<string> {
  const root = db as unknown as OrmRoot;
  const user = await root.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  }
  if (!user.companyId) {
    throw makeHttpError(409, 'ONBOARDING_REQUIRED', 'El usuario no tiene empresa configurada');
  }
  return user.companyId;
}

// ─── Casos de uso ────────────────────────────────────────────

export async function list(
  userId: string,
  query: ListProductsQuery,
): Promise<PaginatedResponse<ProductPublic>> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Product = root.orm.public.Product;

  const filter: Record<string, unknown> = { companyId };
  if (query.category) filter.category = query.category;
  if (query.active !== undefined) filter.active = query.active;

  // MVP: traemos todos los matches del filtro SQL y buscamos/paginamos en JS.
  let all = await Product.where(filter).all();

  if (query.search) {
    const s = query.search.toLowerCase();
    all = all.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.sku !== null && p.sku.toLowerCase().includes(s)),
    );
  }

  all.sort((a, b) => toIso(b.createdAt).localeCompare(toIso(a.createdAt)));

  const total = all.length;
  const start = (query.page - 1) * query.pageSize;
  const items = all.slice(start, start + query.pageSize).map(toProductPublic);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getById(
  userId: string,
  id: string,
): Promise<ProductPublic> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Product = root.orm.public.Product;

  const product = await Product.where({ id, companyId }).first();
  if (!product) {
    throw makeHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
  }
  return toProductPublic(product);
}

export async function create(
  userId: string,
  input: CreateProductInput,
): Promise<ProductPublic> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Product = root.orm.public.Product;

  const sku = normalizeSku(input.sku);

  // Pre-check SKU unico (UX) - el unique constraint es red de seguridad.
  if (sku) {
    const existing = await Product.where({ companyId, sku }).first();
    if (existing) {
      throw makeHttpError(409, 'SKU_TAKEN', 'El SKU ya existe en tu empresa');
    }
  }

  const product = await Product.create({
    name: input.name,
    sku,
    category: input.category,
    type: input.type,
    price: input.price,
    stock: parseStock(input.type, input.stock),
    description: input.description ?? null,
    images: input.images ?? [],
    active: input.active,
    taxable: input.taxable,
    featured: input.featured,
    companyId,
  });

  return toProductPublic(product);
}

export async function update(
  userId: string,
  id: string,
  input: UpdateProductInput,
): Promise<ProductPublic> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Product = root.orm.public.Product;

  const current = await Product.where({ id, companyId }).first();
  if (!current) {
    throw makeHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.type !== undefined) data.type = input.type;
  if (input.price !== undefined) data.price = input.price;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.images !== undefined) data.images = input.images;
  if (input.active !== undefined) data.active = input.active;
  if (input.taxable !== undefined) data.taxable = input.taxable;
  if (input.featured !== undefined) data.featured = input.featured;

  // SKU: normalizar y verificar duplicado si cambia.
  if (input.sku !== undefined) {
    const newSku = normalizeSku(input.sku);
    if (newSku && newSku !== current.sku) {
      const dup = await Product.where({ companyId, sku: newSku }).first();
      if (dup && dup.id !== id) {
        throw makeHttpError(409, 'SKU_TAKEN', 'El SKU ya existe en tu empresa');
      }
    }
    data.sku = newSku;
  }

  // stock: solo si se envio explicitamente y el tipo no es service.
  const newType = input.type ?? current.type;
  if (input.stock !== undefined) {
    data.stock = parseStock(newType, input.stock);
  } else if (input.type === 'service') {
    data.stock = 0;
  }

  const updated = await Product.where({ id, companyId }).update(data);
  return toProductPublic(updated);
}

export async function remove(userId: string, id: string): Promise<void> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Product = root.orm.public.Product;

  const current = await Product.where({ id, companyId }).first();
  if (!current) {
    throw makeHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
  }

  // Si hay InvoiceItem referenciando el producto, PostgreSQL lanza 23503
  // (FK RESTRICT) y errorMiddleware lo mapea a 409 FOREIGN_KEY_CONFLICT.
  await Product.where({ id, companyId }).delete();
}