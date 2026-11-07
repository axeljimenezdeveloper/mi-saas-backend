// src/modules/billing/billing.service.ts
// Logica de negocio del modulo billing.
//
// Reglas del manual (Seccion 14):
//   - Crear factura descuenta stock de cada producto.
//   - Re-validar stock al guardar (race condition).
//   - Estados: PENDING -> PAID | OVERDUE. Cambiar estado NO toca stock.
//   - Total = subtotal + IVA (defaultIva de la Company).
//   - invoice.number = FAC-YYYY-NNNN (por empresa, dentro de la transaccion).
//
// Ownership: todas las queries filtran por companyId del user autenticado.
// Transaccionalidad: POST /invoices usa db.transaction para atomicidad.
//
// Nota Prisma 8: Invoice.count() no es un metodo de query (solo existe dentro
// de include() refinement callbacks). Para numeracion usamos where({companyId}).all().length.

import { db } from '../../prisma/db.js';
import type { PaginatedResponse } from '../../types/index.js';
import type {
  CreateInvoiceInput,
  UpdateStatusInput,
  ListInvoicesQuery,
} from './billing.types.js';

// â”€â”€â”€ Tipos de fila Prisma (runtime) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE';

interface PrismaInvoiceRow {
  id: string;
  number: string;
  client: string;
  date: Date | string;
  total: number | string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  companyId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface PrismaInvoiceItemRow {
  id: string;
  invoiceId: string;
  productId: string;
  price: number | string;
  quantity: number;
}

interface PrismaProductRow {
  id: string;
  name: string;
  price: number | string;
  stock: number;
  companyId: string;
}

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
  companyId: string | null;
}

interface QueryChain<T> {
  first: () => Promise<T | null>;
  all: () => Promise<T[]>;
  update: (d: Record<string, unknown>) => Promise<T>;
  delete: () => Promise<unknown>;
}

interface PrismaInvoiceDelegate {
  where: (w: Record<string, unknown>) => QueryChain<PrismaInvoiceRow>;
  create: (d: Record<string, unknown>) => Promise<PrismaInvoiceRow>;
}

interface PrismaInvoiceItemDelegate {
  where: (w: Record<string, unknown>) => QueryChain<PrismaInvoiceItemRow>;
  create: (d: Record<string, unknown>) => Promise<PrismaInvoiceItemRow>;
}

interface PrismaProductDelegate {
  where: (w: Record<string, unknown>) => QueryChain<PrismaProductRow>;
}

interface PrismaCompanyDelegate {
  where: (w: Record<string, unknown>) => QueryChain<PrismaCompanyRow>;
}

interface PrismaUserDelegate {
  where: (w: Record<string, unknown>) => {
    first: () => Promise<PrismaUserRow | null>;
  };
}

interface OrmRoot {
  orm: {
    public: {
      Invoice: PrismaInvoiceDelegate;
      InvoiceItem: PrismaInvoiceItemDelegate;
      Product: PrismaProductDelegate;
      Company: PrismaCompanyDelegate;
      User: PrismaUserDelegate;
    };
  };
}

// â”€â”€â”€ Tipos publicos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface InvoiceItemPublic {
  id: string;
  productId: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface InvoicePublic {
  id: string;
  number: string;
  client: string;
  date: string;
  total: number;
  status: InvoiceStatus;
  pdfUrl: string | null;
  companyId: string;
  items: InvoiceItemPublic[];
  createdAt: string;
  updatedAt: string;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

function toInvoiceItemPublic(i: PrismaInvoiceItemRow): InvoiceItemPublic {
  const price = toNumber(i.price);
  return {
    id: i.id,
    productId: i.productId,
    price,
    quantity: i.quantity,
    subtotal: Math.round(price * i.quantity * 100) / 100,
  };
}

function toInvoicePublic(
  inv: PrismaInvoiceRow,
  items: PrismaInvoiceItemRow[],
): InvoicePublic {
  return {
    id: inv.id,
    number: inv.number,
    client: inv.client,
    date: toIso(inv.date),
    total: toNumber(inv.total),
    status: inv.status,
    pdfUrl: inv.pdfUrl,
    companyId: inv.companyId,
    items: items.map(toInvoiceItemPublic),
    createdAt: toIso(inv.createdAt),
    updatedAt: toIso(inv.updatedAt),
  };
}

function makeHttpError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Error & { status: number; body: { code: string; message: string; details?: unknown } } {
  const err = new Error(message) as Error & {
    status: number;
    body: { code: string; message: string; details?: unknown };
  };
  err.status = status;
  err.body = { code, message };
  if (details !== undefined) err.body.details = details;
  return err;
}

async function resolveCompanyId(userId: string): Promise<string> {
  const root = db as unknown as OrmRoot;
  const user = await root.orm.public.User.where({ id: userId }).first();
  if (!user) throw makeHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  if (!user.companyId) {
    throw makeHttpError(409, 'ONBOARDING_REQUIRED', 'El usuario no tiene empresa configurada');
  }
  return user.companyId;
}

function padNumber(n: number): string {
  return n.toString().padStart(4, '0');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// â”€â”€â”€ Casos de uso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function list(
  userId: string,
  query: ListInvoicesQuery,
): Promise<PaginatedResponse<InvoicePublic>> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Invoice = root.orm.public.Invoice;
  const InvoiceItem = root.orm.public.InvoiceItem;

  const filter: Record<string, unknown> = { companyId };
  if (query.status) filter.status = query.status;

  let all = await Invoice.where(filter).all();

  if (query.search) {
    const s = query.search.toLowerCase();
    all = all.filter(
      (inv) =>
        inv.number.toLowerCase().includes(s) ||
        inv.client.toLowerCase().includes(s),
    );
  }

  all.sort((a, b) => toIso(b.date).localeCompare(toIso(a.date)));

  const total = all.length;
  const start = (query.page - 1) * query.pageSize;
  const pageInvoices = all.slice(start, start + query.pageSize);

  const items: InvoicePublic[] = [];
  for (const inv of pageInvoices) {
    const invItems = await InvoiceItem.where({ invoiceId: inv.id }).all();
    items.push(toInvoicePublic(inv, invItems));
  }

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getById(
  userId: string,
  id: string,
): Promise<InvoicePublic> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Invoice = root.orm.public.Invoice;
  const InvoiceItem = root.orm.public.InvoiceItem;

  const inv = await Invoice.where({ id, companyId }).first();
  if (!inv) throw makeHttpError(404, 'INVOICE_NOT_FOUND', 'Factura no encontrada');

  const items = await InvoiceItem.where({ invoiceId: inv.id }).all();
  return toInvoicePublic(inv, items);
}

export async function create(
  userId: string,
  input: CreateInvoiceInput,
): Promise<InvoicePublic> {
  const companyId = await resolveCompanyId(userId);

  // Pre-validacion: verificar productos y stock.
  const root = db as unknown as OrmRoot;
  const productMap = new Map<string, PrismaProductRow>();

  for (const pid of new Set(input.items.map((i) => i.productId))) {
    const p = await root.orm.public.Product.where({ id: pid, companyId }).first();
    if (!p) {
      throw makeHttpError(404, 'PRODUCT_NOT_FOUND', `Producto ${pid} no encontrado en tu empresa`);
    }
    productMap.set(pid, p);
  }

  const requiredByProduct = new Map<string, number>();
  for (const item of input.items) {
    const current = requiredByProduct.get(item.productId) ?? 0;
    requiredByProduct.set(item.productId, current + item.quantity);
  }
  for (const [pid, required] of requiredByProduct) {
    const p = productMap.get(pid)!;
    if (p.stock < required) {
      throw makeHttpError(
        409,
        'INSUFFICIENT_STOCK',
        `Stock insuficiente para ${p.name}. Disponible: ${p.stock}, solicitado: ${required}`,
        { productId: pid, available: p.stock, requested: required },
      );
    }
  }

  // Company para IVA.
  const company = await root.orm.public.Company.where({ id: companyId }).first();
  if (!company) {
    throw makeHttpError(404, 'COMPANY_NOT_FOUND', 'Empresa no encontrada');
  }
  const ivaPct = Number(company.defaultIva);
  const subtotal = round2(
    input.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  );
  const total = round2(subtotal * (1 + ivaPct / 100));

  // Transaccion: numero + crear invoice + crear items + descontar stock.
  const result = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as OrmRoot;
    const Invoice = tx.orm.public.Invoice;
    const InvoiceItem = tx.orm.public.InvoiceItem;
    const Product = tx.orm.public.Product;

    // Numero FAC-YYYY-NNNN POR EMPRESA. Prisma 8 no tiene Invoice.count() como
    // query method; usamos where({companyId}).all().length dentro de la tx para
    // minimizar race conditions. El @@unique([companyId, number]) es la red de
    // seguridad final si dos tx concurrentes generan el mismo number.
    const year = new Date().getFullYear();
    const existing = await Invoice.where({ companyId }).all();
    const number = `FAC-${year}-${padNumber(existing.length + 1)}`;

    // Re-validar stock DENTRO de la transaccion.
    for (const [pid, required] of requiredByProduct) {
      const current = await Product.where({ id: pid, companyId }).first();
      if (!current) {
        throw makeHttpError(404, 'PRODUCT_NOT_FOUND', `Producto ${pid} desaparecio durante la transaccion`);
      }
      if (current.stock < required) {
        throw makeHttpError(
          409,
          'INSUFFICIENT_STOCK',
          `Stock insuficiente (revalidacion) para ${current.name}. Disponible: ${current.stock}, solicitado: ${required}`,
          { productId: pid, available: current.stock, requested: required },
        );
      }
    }

    const inv = await Invoice.create({
      number,
      client: input.client,
      total,
      status: 'PENDING',
      pdfUrl: null,
      companyId,
    });

    const createdItems: PrismaInvoiceItemRow[] = [];
    for (const item of input.items) {
      const created = await InvoiceItem.create({
        invoiceId: inv.id,
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
      });
      createdItems.push(created);
    }

    for (const [pid, required] of requiredByProduct) {
      const current = await Product.where({ id: pid, companyId }).first();
      if (!current) continue;
      await Product.where({ id: pid, companyId }).update({
        stock: current.stock - required,
      });
    }

    return { inv, createdItems };
  });

  return toInvoicePublic(result.inv, result.createdItems);
}

export async function updateStatus(
  userId: string,
  id: string,
  input: UpdateStatusInput,
): Promise<InvoicePublic> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Invoice = root.orm.public.Invoice;
  const InvoiceItem = root.orm.public.InvoiceItem;

  const inv = await Invoice.where({ id, companyId }).first();
  if (!inv) throw makeHttpError(404, 'INVOICE_NOT_FOUND', 'Factura no encontrada');

  if (inv.status === input.status) {
    throw makeHttpError(
      400,
      'NO_STATUS_CHANGE',
      `La factura ya esta en estado ${input.status}`,
    );
  }
  if (inv.status === 'PAID') {
    throw makeHttpError(
      409,
      'INVALID_STATUS_TRANSITION',
      'No se puede cambiar el estado de una factura pagada',
    );
  }

  const updated = await Invoice.where({ id, companyId }).update({
    status: input.status,
  });
  const items = await InvoiceItem.where({ invoiceId: inv.id }).all();
  return toInvoicePublic(updated, items);
}

export async function remove(userId: string, id: string): Promise<void> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;
  const Invoice = root.orm.public.Invoice;

  const inv = await Invoice.where({ id, companyId }).first();
  if (!inv) throw makeHttpError(404, 'INVOICE_NOT_FOUND', 'Factura no encontrada');

  // Nota: el manual no especifica restauracion de stock al eliminar.
  // Se documenta en el informe: en el MVP, eliminar una factura NO restaura
  // stock (el stock es un registro de movimientos fisicos ya realizados).
  await Invoice.where({ id, companyId }).delete();
}
// â”€â”€â”€ Paso 6: PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface InvoiceFullForPdf {
  invoice: InvoicePublic;
  company: { name: string; rif: string; address: string; currency: string };
  items: Array<{ productName: string; price: number; quantity: number; subtotal: number }>;
}

/** Devuelve la factura enriquecida con datos de empresa y nombres de producto
 *  para alimentar el generador de PDF. */
export async function getForPdf(
  userId: string,
  invoiceId: string,
): Promise<InvoiceFullForPdf> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;

  const inv = await root.orm.public.Invoice.where({ id: invoiceId, companyId }).first();
  if (!inv) throw makeHttpError(404, 'INVOICE_NOT_FOUND', 'Factura no encontrada');

  const company = await root.orm.public.Company.where({ id: companyId }).first();
  if (!company) throw makeHttpError(404, 'COMPANY_NOT_FOUND', 'Empresa no encontrada');

  const invItems = await root.orm.public.InvoiceItem.where({ invoiceId: inv.id }).all();

  const enriched: Array<{ productName: string; price: number; quantity: number; subtotal: number }> = [];
  for (const it of invItems) {
    const p = await root.orm.public.Product.where({ id: it.productId, companyId }).first();
    const productName = p ? p.name : '[Producto eliminado]';
    const price = toNumber(it.price);
    enriched.push({
      productName,
      price,
      quantity: it.quantity,
      subtotal: Math.round(price * it.quantity * 100) / 100,
    });
  }

  return {
    invoice: toInvoicePublic(inv, invItems),
    company: {
      name: company.name,
      rif: company.rif,
      address: company.address,
      currency: company.currency,
    },
    items: enriched,
  };
}

/** Actualiza el campo pdfUrl de una factura. */
export async function updatePdfUrl(
  userId: string,
  invoiceId: string,
  pdfUrl: string,
): Promise<void> {
  const companyId = await resolveCompanyId(userId);
  const root = db as unknown as OrmRoot;

  const inv = await root.orm.public.Invoice.where({ id: invoiceId, companyId }).first();
  if (!inv) throw makeHttpError(404, 'INVOICE_NOT_FOUND', 'Factura no encontrada');

  await root.orm.public.Invoice.where({ id: invoiceId, companyId }).update({ pdfUrl });
}