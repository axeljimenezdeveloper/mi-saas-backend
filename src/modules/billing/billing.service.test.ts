// src/modules/billing/billing.service.test.ts
// Tests de la logica de negocio del modulo billing.
// Cubren los fixes v1.1.0:
//   - 1.1: el backend ignora input.items[].price y usa product.price
//   - 1.2: forUpdate() serializa la revalidacion y decrementa stock bajo lock
//   - 2.2: OVERDUE -> PENDING es rechazado con INVALID_STATUS_TRANSITION

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  makeUser,
  makeProduct,
  makeCompany,
  makeInvoice,
  makeInvoiceItem,
} from '../../test/factories.js';

// ═════════════════════════════════════════════════════════════
// Mock state: configurable por test, con assertions via state.*
// vi.hoisted se ejecuta antes de los imports, por eso está aislado.
// ═════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => {
  type AnyRow = Record<string, unknown>;

  interface State {
    user: AnyRow | null;
    company: AnyRow | null;
    product: AnyRow | null;
    invoice: AnyRow | null;
    invoiceItems: AnyRow[];
    existingInvoices: AnyRow[];
    createdInvoice: AnyRow | null;
    createdItems: AnyRow[];
    stockUpdates: Array<{ whereId: unknown; stock: unknown }>;
    forUpdateCalls: number;
    invoiceUpdates: AnyRow[];
    productUpdates: AnyRow[];
  }

  const state: State = {
    user: null,
    company: null,
    product: null,
    invoice: null,
    invoiceItems: [],
    existingInvoices: [],
    createdInvoice: null,
    createdItems: [],
    stockUpdates: [],
    forUpdateCalls: 0,
    invoiceUpdates: [],
    productUpdates: [],
  };

  function makeChain(kind: 'Product' | 'Company' | 'Invoice' | 'InvoiceItem' | 'User') {
    let lastWhere: AnyRow = {};

    const chain: AnyRow = {
      where(w: AnyRow) {
        lastWhere = w;
        return chain;
      },
      forUpdate() {
        state.forUpdateCalls += 1;
        return chain;
      },
      forShare() {
        return chain;
      },
      async first() {
        if (kind === 'Product') return state.product;
        if (kind === 'Company') return state.company;
        if (kind === 'Invoice') return state.invoice;
        if (kind === 'User') return state.user;
        return null;
      },
      async all() {
        if (kind === 'Invoice') return state.existingInvoices;
        if (kind === 'InvoiceItem') return state.invoiceItems;
        return [];
      },
      async update(data: AnyRow) {
        if (kind === 'Product') {
          state.productUpdates.push(data);
          state.stockUpdates.push({ whereId: lastWhere.id, stock: data.stock });
          return { ...(state.product ?? {}), ...data };
        }
        if (kind === 'Invoice') {
          state.invoiceUpdates.push(data);
          const updated = { ...(state.invoice ?? {}), ...data };
          return updated;
        }
        return { ...data };
      },
      async create(data: AnyRow) {
        if (kind === 'Invoice') {
          const created = {
            ...data,
            id: 'invoice-new',
            date: new Date('2026-11-11T12:00:00Z'),
            createdAt: new Date('2026-11-11T12:00:00Z'),
            updatedAt: new Date('2026-11-11T12:00:00Z'),
          };
          state.createdInvoice = created;
          return created;
        }
        if (kind === 'InvoiceItem') {
          const created = {
            ...data,
            id: `item-new-${state.createdItems.length + 1}`,
          };
          state.createdItems.push(created);
          return created;
        }
        return { ...data };
      },
    };

    return chain;
  }

  const dbMock: AnyRow = {
    orm: {
      public: {
        Product: makeChain('Product'),
        Company: makeChain('Company'),
        Invoice: makeChain('Invoice'),
        InvoiceItem: makeChain('InvoiceItem'),
        User: makeChain('User'),
      },
    },
    async transaction<T>(fn: (tx: AnyRow) => Promise<T>): Promise<T> {
      return fn(dbMock);
    },
  };

  return { state, dbMock };
});

vi.mock('../../prisma/db.js', () => ({ db: mocks.dbMock }));
vi.mock('../notifications/notification.service.js', () => ({
  notify: vi.fn(async () => undefined),
}));

// ═════════════════════════════════════════════════════════════
// Import del service (post-mock)
// ═════════════════════════════════════════════════════════════

import * as billingService from './billing.service.js';

// ═════════════════════════════════════════════════════════════
// Helpers de setup
// ═════════════════════════════════════════════════════════════

function resetState() {
  const s = mocks.state;
  s.user = makeUser({ companyId: 'company-1' });
  s.company = makeCompany({ id: 'company-1', defaultIva: '16' });
  s.product = makeProduct({ id: 'product-1', price: 100, stock: 10 });
  s.invoice = null;
  s.invoiceItems = [];
  s.existingInvoices = [];
  s.createdInvoice = null;
  s.createdItems = [];
  s.stockUpdates = [];
  s.forUpdateCalls = 0;
  s.invoiceUpdates = [];
  s.productUpdates = [];
}

const VALID_INPUT = {
  client: 'Cliente Test',
  items: [
    {
      productId: 'product-1',
      productName: 'Laptop Test',
      price: 0.01,
      quantity: 2,
    },
  ],
};

// ═════════════════════════════════════════════════════════════
// TESTS: create() — Fix 1.1 (pricing) + Fix 1.2 (stock lock)
// ═════════════════════════════════════════════════════════════

describe('billing.service.create()', () => {
  beforeEach(resetState);

  it('ignores the price sent by the client and uses product.price (Fix 1.1)', async () => {
    await billingService.create('user-1', VALID_INPUT);

    expect(mocks.state.createdItems).toHaveLength(1);
    expect(mocks.state.createdItems[0].price).toBe(100);
    expect(mocks.state.createdInvoice?.total).toBe(232);
  });

  it('uses product.price for the subtotal calculation (Fix 1.1)', async () => {
    await billingService.create('user-1', {
      client: 'Cliente Test',
      items: [
        {
          productId: 'product-1',
          productName: 'Laptop Test',
          price: 0.01,
          quantity: 1,
        },
      ],
    });

    expect(mocks.state.createdInvoice?.total).toBe(116);
    expect(mocks.state.createdItems[0].price).toBe(100);
  });

  it('calls forUpdate() before decrementing stock (Fix 1.2)', async () => {
    await billingService.create('user-1', VALID_INPUT);

    expect(mocks.state.forUpdateCalls).toBeGreaterThan(0);
  });

  it('decrements stock by the requested quantity (Fix 1.2)', async () => {
    await billingService.create('user-1', VALID_INPUT);

    expect(mocks.state.stockUpdates).toHaveLength(1);
    expect(mocks.state.stockUpdates[0].stock).toBe(8);
    expect(mocks.state.stockUpdates[0].whereId).toBe('product-1');
  });

  it('throws INSUFFICIENT_STOCK when stock is below the requested quantity', async () => {
    mocks.state.product = makeProduct({ id: 'product-1', price: 100, stock: 1 });

    await expect(
      billingService.create('user-1', VALID_INPUT),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'INSUFFICIENT_STOCK' },
    });
  });

  it('throws PRODUCT_NOT_FOUND when a product does not exist', async () => {
    mocks.state.product = null;

    await expect(
      billingService.create('user-1', VALID_INPUT),
    ).rejects.toMatchObject({
      status: 404,
      body: { code: 'PRODUCT_NOT_FOUND' },
    });
  });

  it('throws ONBOARDING_REQUIRED when the user has no company', async () => {
    mocks.state.user = makeUser({ companyId: null });

    await expect(
      billingService.create('user-1', VALID_INPUT),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'ONBOARDING_REQUIRED' },
    });
  });
});

// ═════════════════════════════════════════════════════════════
// TESTS: updateStatus() — Fix 2.2 (transiciones)
// ═════════════════════════════════════════════════════════════

describe('billing.service.updateStatus()', () => {
  beforeEach(resetState);

  it('blocks OVERDUE -> PENDING transition (Fix 2.2)', async () => {
    mocks.state.invoice = makeInvoice({ status: 'OVERDUE' });

    await expect(
      billingService.updateStatus('user-1', 'invoice-1', { status: 'PENDING' }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'INVALID_STATUS_TRANSITION' },
    });
    expect(mocks.state.invoiceUpdates).toHaveLength(0);
  });

  it('blocks any transition from PAID', async () => {
    mocks.state.invoice = makeInvoice({ status: 'PAID' });

    await expect(
      billingService.updateStatus('user-1', 'invoice-1', { status: 'PENDING' }),
    ).rejects.toMatchObject({
      status: 409,
      body: { code: 'INVALID_STATUS_TRANSITION' },
    });
  });

  it('allows PENDING -> PAID', async () => {
    mocks.state.invoice = makeInvoice({ status: 'PENDING' });

    const updated = await billingService.updateStatus('user-1', 'invoice-1', {
      status: 'PAID',
    });

    expect(updated.status).toBe('PAID');
    expect(mocks.state.invoiceUpdates).toHaveLength(1);
  });

  it('allows OVERDUE -> PAID', async () => {
    mocks.state.invoice = makeInvoice({ status: 'OVERDUE' });

    const updated = await billingService.updateStatus('user-1', 'invoice-1', {
      status: 'PAID',
    });

    expect(updated.status).toBe('PAID');
  });

  it('rejects when the new status equals the current one', async () => {
    mocks.state.invoice = makeInvoice({ status: 'PENDING' });

    await expect(
      billingService.updateStatus('user-1', 'invoice-1', { status: 'PENDING' }),
    ).rejects.toMatchObject({
      status: 400,
      body: { code: 'NO_STATUS_CHANGE' },
    });
  });
});