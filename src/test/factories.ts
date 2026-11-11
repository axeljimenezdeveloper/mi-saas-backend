// src/test/factories.ts
// Factories de filas Prisma para tests.
// Cada una acepta overrides parciales y devuelve un objeto completo
// con defaults sensatos. Los tests solo cambian lo que necesitan.

export interface UserRowOverrides {
  id?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'ADMIN' | 'CASHIER';
  companyId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function makeUser(overrides: UserRowOverrides = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    password: '$2b$10$hashedpassword',
    name: 'Test User',
    role: 'ADMIN' as const,
    companyId: 'company-1' as string | null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export interface CompanyRowOverrides {
  id?: string;
  name?: string;
  rif?: string;
  address?: string;
  currency?: 'VES' | 'USD';
  defaultIva?: string;
  businessType?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function makeCompany(overrides: CompanyRowOverrides = {}) {
  return {
    id: 'company-1',
    name: 'Empresa Test C.A.',
    rif: 'J-12345678-9',
    address: 'Av. Test 123',
    currency: 'VES' as const,
    defaultIva: '16',
    businessType: 'retail',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export interface ProductRowOverrides {
  id?: string;
  name?: string;
  sku?: string | null;
  category?: string;
  type?: string;
  price?: number | string;
  stock?: number;
  description?: string | null;
  images?: string[];
  active?: boolean;
  taxable?: boolean;
  featured?: boolean;
  companyId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function makeProduct(overrides: ProductRowOverrides = {}) {
  return {
    id: 'product-1',
    name: 'Laptop Test',
    sku: 'LAP-001',
    category: 'electronics',
    type: 'physical',
    price: 100,
    stock: 10,
    description: null,
    images: [],
    active: true,
    taxable: true,
    featured: false,
    companyId: 'company-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export interface InvoiceRowOverrides {
  id?: string;
  number?: string;
  client?: string;
  date?: Date | string;
  total?: number | string;
  status?: 'PENDING' | 'PAID' | 'OVERDUE';
  pdfUrl?: string | null;
  companyId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function makeInvoice(overrides: InvoiceRowOverrides = {}) {
  return {
    id: 'invoice-1',
    number: 'FAC-2026-0001',
    client: 'Cliente Test',
    date: new Date('2026-01-01T00:00:00Z'),
    total: 116,
    status: 'PENDING' as const,
    pdfUrl: null,
    companyId: 'company-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export interface InvoiceItemRowOverrides {
  id?: string;
  invoiceId?: string;
  productId?: string;
  price?: number | string;
  quantity?: number;
}

export function makeInvoiceItem(overrides: InvoiceItemRowOverrides = {}) {
  return {
    id: 'item-1',
    invoiceId: 'invoice-1',
    productId: 'product-1',
    price: 100,
    quantity: 1,
    ...overrides,
  };
}