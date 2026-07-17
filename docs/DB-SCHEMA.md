# Database schema — منصة القراءة القصدية

Everything under `public` is defined by TypeORM entities (`src/database/entities/*.ts`)
and brought up by migrations (`src/database/migrations/*.ts`) —
`synchronize` is OFF everywhere by default.

## Migrations

| Timestamp        | Name                     | Purpose                                                    |
|------------------|--------------------------|------------------------------------------------------------|
| 1720000000000    | `InitSchema`             | Builds the schema from the current entity metadata.        |
| 1720000000100    | `RoleHardening`          | Installs the `qasdiya_guard_super_admin` trigger that blocks any INSERT/UPDATE that would produce a `super_admin` unless the session variable `qasdiya.bootstrap = 'on'` is set — the only privileged path is `scripts/bootstrap-owner.ts`. |

## Tables

### `users`

| column               | type                | notes                                     |
|----------------------|---------------------|-------------------------------------------|
| `id`                 | uuid PK             |                                           |
| `fullName`           | varchar(200)        |                                           |
| `email`              | varchar(200) UNIQUE |                                           |
| `passwordHash`       | varchar(200)        | bcrypt                                    |
| `phone/country/city` | varchar             | nullable                                  |
| `preferredLang`      | varchar(8)          | default `ar`                              |
| `role`               | varchar(24)         | one of the 6 IRPB roles; guarded by trigger |
| `emailVerified`      | boolean             |                                           |
| `isActive`           | boolean             |                                           |
| `privacyAccepted`    | boolean             |                                           |
| `termsAccepted`      | boolean             |                                           |
| `acceptedAt`         | timestamptz         |                                           |
| `tokenVersion`       | integer             | bumped on password change/reset to invalidate old JWTs |
| `createdAt/updatedAt`| timestamptz         |                                           |

**Trigger**: `trg_users_guard_super_admin BEFORE INSERT OR UPDATE OF role`.

### `email_verification_tokens` / `password_reset_tokens`

| column       | type              | notes                            |
|--------------|-------------------|----------------------------------|
| `id`         | uuid PK           |                                  |
| `userId`     | uuid              | indexed                          |
| `tokenHash`  | varchar(64) UNIQUE| SHA-256 of the emailed token     |
| `expiresAt`  | timestamptz       |                                  |
| `consumedAt` | timestamptz null  | enforces single-use              |
| `requestIp`  | varchar(64) null  | reset token only                 |
| `createdAt`  | timestamptz       |                                  |

### `book_categories`

`id, slug UNIQUE, name jsonb, description jsonb, displayOrder, createdAt/updatedAt`.

### `books`

| column             | type              | notes                                    |
|--------------------|-------------------|------------------------------------------|
| `id`               | uuid PK           |                                          |
| `slug`             | varchar(160) UQ   |                                          |
| `title/author/description` | jsonb     | localized                                |
| `coverImagePath`   | varchar(255) null |                                          |
| `masterPdfPath`    | varchar(500)      | relative to `STORAGE_ROOT/books`; validated |
| `editionVersion`   | varchar(32)       | bumped when a new master is uploaded     |
| `samplePdfPath`    | varchar(500) null | publicly downloadable preview            |
| `pageCount`        | integer           |                                          |
| `priceUsd`         | numeric(10,2)     |                                          |
| `priceIqd`         | numeric(12,2) null|                                          |
| `keywords`         | text[]            |                                          |
| `categoryId`       | uuid null → book_categories |                                |
| `isFeatured`       | boolean           |                                          |
| `status`           | varchar(16)       | `draft` / `published` / `suspended`      |
| `publishedAt`      | timestamptz null  |                                          |
| `createdAt/updatedAt` | timestamptz    |                                          |

Indexes: `idx_books_status_featured (status, isFeatured)`.

### `articles`

`id, slug UNIQUE, title/excerpt/body jsonb, authorDisplay, category, tags[], metaTitle/metaDescription jsonb, status, publishedAt, timestamps`.

### `bank_accounts`

`id, bankName, accountHolder, accountNumber, iban null, currency, notes, isActive, displayOrder, timestamps`.

### `orders`

| column                | type            | notes                                    |
|-----------------------|-----------------|------------------------------------------|
| `id`                  | uuid PK         |                                          |
| `orderNumber`         | varchar(32) UQ  | `QSD-YYYYMMDD-NNNNNN`                    |
| `userId`              | uuid → users    | RESTRICT                                 |
| `bookId`              | uuid → books    | RESTRICT                                 |
| `amount, currency`    | numeric / varchar |                                        |
| `status`              | varchar(24)     | `pending_payment/awaiting_review/approved/fulfilled/rejected/cancelled` |
| `agreementAccepted`   | boolean         |                                          |
| `agreementAcceptedAt` | timestamptz     |                                          |
| `rejectionReason`     | text null       |                                          |
| `approvedAt/approvedByUserId/fulfilledAt` | ts + uuid |                              |
| `createdAt/updatedAt` | timestamptz     |                                          |

### `order_transfer_proofs`

`id, orderId → orders CASCADE, transferReference, transferAmount, transferCurrency, transferDate, proofImagePath, targetBankAccountId null, notes, createdAt`.

### `issued_copies` (purchase identity)

| column                          | type              | notes                            |
|---------------------------------|-------------------|----------------------------------|
| `id`                            | uuid PK           |                                  |
| `copyUuid`                      | uuid UNIQUE       | stable across reissues           |
| `orderId`                       | uuid UNIQUE → orders |                              |
| `userId`                        | uuid → users      |                                  |
| `bookId`                        | uuid → books      |                                  |
| `buyerFullName/Email/Phone/Country/City` | snapshot at first issue |            |
| `generatedFilePath`             | varchar(500)      | cache of current generation      |
| `fileSha256`                    | varchar(128)      | cache of current generation      |
| `currentGenerationNumber`       | integer           |                                  |
| `currentGenerationId`           | uuid null         |                                  |
| `visibleWatermark`              | varchar(500)      |                                  |
| `hiddenWatermarkPayload`        | text              | JSON                             |
| `issuedAt/updatedAt`            | timestamptz       |                                  |

### `issued_copy_generations` (immutable audit — one row per PDF file ever produced)

| column               | type            | notes                                    |
|----------------------|-----------------|------------------------------------------|
| `id`                 | uuid PK         |                                          |
| `issuedCopyId`       | uuid → issued_copies CASCADE |                             |
| `generationId`       | uuid UNIQUE     | unique to this specific file             |
| `generationNumber`   | integer         | 1-based sequence per issued copy         |
| `filePath`           | varchar(500)    | relative path in `GENERATED_DIR`         |
| `fileSha256`         | varchar(128)    | of the produced bytes                    |
| `signedPayload`      | jsonb           | canonical fields fed into the HMAC       |
| `signature`          | jsonb           | `{ algo, keyId, signedAt, value }`       |
| `reason`             | varchar(32)     | `initial` / `reissue` / `admin_reissue`  |
| `triggeredByUserId`  | uuid null       |                                          |
| `createdAt`          | timestamptz     |                                          |

Constraint: `uq_generation_per_copy UNIQUE (issuedCopyId, generationNumber)`.

### `download_logs`

`id, issuedCopyId → issued_copies CASCADE, userId, ipAddress, userAgent (500), browser, os, downloadedAt`.

### `audit_logs`

`id, actorUserId null, actorRole, action, entity, entityId null, metadata jsonb null, ipAddress, createdAt`.

Indexes on `actorUserId` and `action`.

### `content_pages`

`id, key UNIQUE, draftValue jsonb, publishedValue jsonb null, version, publishedAt, updatedByUserId, timestamps`.

### `content_page_versions`

`id, pageId → content_pages CASCADE, version, value jsonb, action ('draft_saved'|'published'), actorUserId, createdAt`.

Constraint: `uq_page_version UNIQUE (pageId, version)`.

### `settings`

`key PK, value jsonb, updatedAt`. Used for non-page settings (contact info, agreement text).

## Indexes summary

- `users.email` UNIQUE
- `email_verification_tokens.tokenHash` UNIQUE, `.userId`
- `password_reset_tokens.tokenHash` UNIQUE, `.userId`
- `books.slug` UNIQUE, `(status, isFeatured)`
- `book_categories.slug` UNIQUE
- `articles.slug` UNIQUE
- `orders.orderNumber` UNIQUE, `.userId`, `.bookId`
- `order_transfer_proofs.orderId`
- `issued_copies.copyUuid` UNIQUE, `.orderId` UNIQUE, `.userId`, `.bookId`
- `issued_copy_generations.generationId` UNIQUE, `.issuedCopyId`
- `download_logs.issuedCopyId`
- `audit_logs.actorUserId`, `.action`
- `content_pages.key` UNIQUE, `content_page_versions.pageId`

## Running the schema

```bash
# Fresh database (production or staging):
createdb qasdiya_platform
npm run migration:run          # runs InitSchema + RoleHardening
npm run seed                   # data only, no super_admin
ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_FULL_NAME=… npm run bootstrap:owner
```

## Rollback

Each migration ships a `down()` that restores the previous state. The
`RoleHardening` down removes the trigger/function; `InitSchema` down drops
the entire `public` schema.
