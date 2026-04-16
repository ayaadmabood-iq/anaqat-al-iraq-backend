# Anaqat Al-Iraq — Backend

> **Anaqat Al-Iraq** (أناقة العراق) is an inventory and sales management platform for Iraqi clothing stores, with native Arabic/English support and a role-based workflow for store owners and staff.

This repository contains the **backend API**, built with [NestJS](https://nestjs.com/), [TypeORM](https://typeorm.io/) and PostgreSQL.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Database Seeding](#database-seeding)
8. [API Reference](#api-reference)
9. [Authentication & Roles](#authentication--roles)
10. [Project Structure](#project-structure)
11. [Scripts](#scripts)
12. [Testing](#testing)
13. [Deployment Notes](#deployment-notes)
14. [License](#license)

---

## Features

- JWT authentication with refresh-friendly design and bcrypt password hashing
- Role-based access control: `OWNER`, `MANAGER`, `SALES_STAFF`, `INVENTORY_STAFF`
- Multi-store architecture (one deployment → many stores)
- Inventory management with category, size, color, style and audience metadata
- Stock tracking per size with safe decrement on sale
- Sales workflow with line items, per-user sales history and summary reports
- Arabic-first data model: categories and content stored in Arabic and English
- Optional image classification via Google Cloud Vision (graceful fallback when disabled)
- Global validation pipe (whitelist, forbidNonWhitelisted, transform)
- CORS with configurable origin, static serving of user uploads
- Audit log entity for traceability of sensitive operations

## Tech Stack

| Layer       | Technology                           |
|-------------|--------------------------------------|
| Runtime     | Node.js 18+                          |
| Framework   | NestJS 10 (Express platform)         |
| Language    | TypeScript 5                         |
| Database    | PostgreSQL 12+                       |
| ORM         | TypeORM 0.3                          |
| Auth        | Passport + JWT, bcrypt               |
| Validation  | class-validator / class-transformer  |
| Uploads     | Multer                               |

## Architecture

A concise module graph:

```
AppModule
├── ConfigModule       (.env loader)
├── TypeOrmModule      (PostgreSQL)
├── AuthModule         (JWT, guards, strategies)
├── UsersModule        (CRUD, role management)
├── StoreModule        (multi-tenant store entity)
├── InventoryModule    (items, sizes, stock, classify)
└── SalesModule        (transactions, reports)
```

See `ARCHITECTURE.md` and `FILE_STRUCTURE.md` for deeper design notes.

## Prerequisites

- Node.js **18+** (LTS recommended)
- PostgreSQL **12+** running locally or remotely
- npm **9+** (or compatible package manager)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/ayaadmabood-iq/anaqat-al-iraq-backend.git
cd anaqat-al-iraq-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# edit .env and set DB_PASSWORD, JWT_SECRET, etc.

# 4. Seed the database (creates schema + demo data)
npm run seed

# 5. Run in dev mode
npm run start:dev
```

The API will be available at **`http://localhost:3000/api/v1`**.

## Environment Variables

Configuration is loaded from `.env` via `@nestjs/config`. A full template lives in [`.env.example`](./.env.example).

| Variable                | Required | Default          | Description                                                                 |
|-------------------------|----------|------------------|-----------------------------------------------------------------------------|
| `DB_HOST`               | yes      | `localhost`      | PostgreSQL host                                                             |
| `DB_PORT`               | yes      | `5432`           | PostgreSQL port                                                             |
| `DB_USERNAME`           | yes      | `postgres`       | PostgreSQL user                                                             |
| `DB_PASSWORD`           | yes      | —                | PostgreSQL password                                                         |
| `DB_DATABASE`           | yes      | `anaqat_iraq`    | Database name                                                               |
| `JWT_SECRET`            | yes      | —                | Secret used to sign JWTs; **must be changed in production**                 |
| `JWT_EXPIRATION`        | no       | `24h`            | JWT lifetime                                                                |
| `PORT`                  | no       | `3000`           | HTTP port                                                                   |
| `UPLOAD_DIR`            | no       | `./uploads`      | Directory for Multer-uploaded files                                         |
| `NODE_ENV`              | no       | `development`    | `development` enables TypeORM `synchronize` and verbose logging             |
| `CORS_ORIGIN`           | no       | `*`              | Comma-separated origins allowed by CORS                                     |
| `GOOGLE_VISION_API_KEY` | no       | (empty)          | Optional; when empty, `/inventory/classify` returns `manual_fallback`       |

> **Never commit `.env`.** It is listed in `.gitignore`; only `.env.example` is tracked.

## Database Seeding

`npm run seed` runs `src/database/seed.ts` which:

- Ensures the schema exists (via TypeORM synchronize)
- Creates a demo store: `متجر الأناقة`
- Creates four demo users — all with password `demo123`:
  - `owner`
  - `manager`
  - `sales`
  - `inventory`
- Creates 13 Arabic/English clothing categories
- Creates 5 sample items with stock records

> The demo password is for local development only. Change it before any shared deployment.

## API Reference

All endpoints are prefixed with `/api/v1`. See [`Anaqat-Al-Iraq.postman_collection.json`](./Anaqat-Al-Iraq.postman_collection.json) for an importable Postman collection.

### Authentication

| Method | Path                | Description               |
|--------|---------------------|---------------------------|
| POST   | `/auth/login`       | Username + password → JWT |
| POST   | `/auth/register`    | Register a new user       |

### Users

| Method | Path                | Access                |
|--------|---------------------|-----------------------|
| GET    | `/users`            | Authenticated         |
| GET    | `/users/:id`        | Authenticated         |
| POST   | `/users`            | Owner, Manager        |
| PATCH  | `/users/:id`        | Owner, Manager        |
| DELETE | `/users/:id`        | Owner                 |

### Stores

| Method | Path                | Access         |
|--------|---------------------|----------------|
| GET    | `/stores`           | Authenticated  |
| POST   | `/stores`           | Authenticated  |
| GET    | `/stores/:id`       | Authenticated  |
| PATCH  | `/stores/:id`       | Owner          |
| DELETE | `/stores/:id`       | Owner          |

### Inventory

| Method | Path                                      |
|--------|-------------------------------------------|
| GET    | `/inventory/items`                        |
| GET    | `/inventory/items/search?q=term`          |
| POST   | `/inventory/items`                        |
| GET    | `/inventory/items/:id`                    |
| PATCH  | `/inventory/items/:id`                    |
| DELETE | `/inventory/items/:id`                    |
| POST   | `/inventory/items/:id/sizes`              |
| PATCH  | `/inventory/items/:id/sizes/:size`        |
| POST   | `/inventory/items/:id/reduce-stock`       |
| DELETE | `/inventory/items/:id/sizes/:size`        |
| GET    | `/inventory/stock/total`                  |
| POST   | `/inventory/classify`                     |

### Sales

| Method | Path                          |
|--------|-------------------------------|
| POST   | `/sales`                      |
| GET    | `/sales`                      |
| GET    | `/sales/:id`                  |
| GET    | `/sales/user/:userId`         |
| GET    | `/sales/report/summary`       |

## Authentication & Roles

Authentication is stateless JWT. Clients:

1. `POST /auth/login` with `{ username, password }` (and optional `?storeId=`)
2. Store the returned `access_token`
3. Attach `Authorization: Bearer <token>` on subsequent requests

Roles:

- **OWNER** — full control, including user and store management
- **MANAGER** — manage users, inventory and sales
- **SALES_STAFF** — process sales and customer sessions
- **INVENTORY_STAFF** — manage items and stock

## Project Structure

```
backend/
├── src/
│   ├── config/           # Config loader
│   ├── database/
│   │   ├── entities/     # TypeORM entities
│   │   └── seed.ts       # Seed script
│   ├── modules/
│   │   ├── auth/         # JWT auth, guards, strategies
│   │   ├── users/        # User CRUD, role logic
│   │   ├── store/        # Store entity
│   │   ├── inventory/    # Items, sizes, classify
│   │   └── sales/        # Transactions, reports
│   ├── types/            # Shared TS types
│   ├── app.module.ts     # Root module
│   └── main.ts           # Bootstrap (CORS, pipes, prefix)
├── uploads/              # Runtime uploads (ignored in git)
├── ARCHITECTURE.md
├── DOCS_INDEX.md
├── FILE_STRUCTURE.md
├── MANIFEST.txt
├── QUICK_START.md
├── backend-audit-report.md
├── Anaqat-Al-Iraq.postman_collection.json
├── .env.example
├── .gitignore
├── LICENSE
├── nest-cli.json
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## Scripts

| Command                | Purpose                                             |
|------------------------|-----------------------------------------------------|
| `npm install`          | Install dependencies                                |
| `npm run start`        | Start in normal mode                                |
| `npm run start:dev`    | Start in watch mode                                 |
| `npm run build`        | Compile TypeScript to `dist/`                       |
| `npm run start:prod`   | Run compiled output (`node dist/main`)              |
| `npm run seed`         | Create schema and populate demo data                |

## Testing

- `Anaqat-Al-Iraq.postman_collection.json` — importable Postman collection
- `test-api.ps1` — PowerShell script to smoke-test the API on Windows
- `setup-and-test.ps1` — end-to-end local setup and test helper

## Deployment Notes

- Set `NODE_ENV=production` and **disable** TypeORM `synchronize`; switch to proper migrations
- Generate a strong `JWT_SECRET` (at least 32 random bytes)
- Replace the default `CORS_ORIGIN=*` with an explicit list of allowed origins
- Place the app behind a reverse proxy (nginx/Caddy) with TLS
- Persist `uploads/` on durable storage or migrate to object storage (S3/MinIO)
- Run `npm ci && npm run build && npm run start:prod`

## License

Released under the [MIT License](./LICENSE).
