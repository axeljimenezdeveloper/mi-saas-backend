# Changelog

All notable changes to mi-saas-backend are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] - 2026-11-11

### Tests

- Add Vitest 5 setup with v8 coverage
- Add billing.service test suite (12 tests) covering pricing, stock lock and status transitions
- Add factories helper for Prisma row mocking
- Add separate tsconfig.build.json to exclude tests from dist/

### Docs

- Add README with setup, endpoints and architecture overview
- Add CHANGELOG

## [1.1.0] - 2026-11-11

### Bug Fixes

- Ignore client-controlled price in invoice creation (use product.price from DB)
- Serialize stock validation and decrement with forUpdate() lock
- Block OVERDUE to PENDING transition (returns 409 INVALID_STATUS_TRANSITION)

### Features

- Redesign invoice PDF layout and respect company.currency
- Add brand bar, 2-column header, status badge, zebra-striped table
- Repeat table header across pages, add generation timestamp in footer

## [1.0.0] - 2026-11-08

### Features

- Initial release: auth, company, inventory, billing, notifications modules
- JWT auth with bcrypt, Zod validation, error middleware
- Persistent notifications emitted by domain services
- Invoice PDF generation with pdfkit
- Prisma ORM 8 RC with PostgreSQL (Neon)