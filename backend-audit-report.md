# Anaqat Al-Iraq Backend — Audit Report

**Date:** 2026-04-15  
**Project:** `C:\Users\HP\Desktop\Inaqet Iraq\anaqat-al-iraq\backend\`  
**Reference:** BACKEND_COMPLETED.md

---

## 1. npm install

**Status: OK (with minor warning)**

`npm install` completes successfully. All dependencies resolve. There is one harmless EPERM warning on `fsevents` (macOS-only module, irrelevant on Windows).

**Result:** 93 packages funded, no errors, no missing peer dependencies.

---

## 2. npm run start:dev / nest build

**Status: FAILS — 132 TypeScript compilation errors**

The build (`nest build`) fails entirely. All 132 errors fall into two categories:

| Error Code | Count | Description |
|---|---|---|
| TS2564 | ~120 | Property has no initializer and is not definitely assigned in the constructor |
| TS7016 | ~12 | Could not find a declaration file for module `uuid` |

**Root Cause — TS2564:** `tsconfig.json` has `"strict": true`, which enables `strictPropertyInitialization`. All TypeORM entity properties (e.g., `storeId: string;`) lack the `!` definite assignment assertion that TypeORM requires.

**Fix:** Either add `"strictPropertyInitialization": false` to `tsconfig.json`, or add `!` to every entity property (e.g., `storeId!: string;`).

**Root Cause — TS7016:** `@types/uuid` is missing from `devDependencies`.

**Fix:** `npm install --save-dev @types/uuid`

**Affected files (all 12 entity files + 4 DTOs + 1 controller):**

- `src/database/entities/*.entity.ts` (all 12 files)
- `src/modules/auth/dto/login.dto.ts`
- `src/modules/auth/dto/register.dto.ts`
- `src/modules/inventory/dto/create-item.dto.ts`
- `src/modules/inventory/dto/reduce-stock.dto.ts`
- `src/modules/sales/dto/create-sale.dto.ts`
- `src/modules/inventory/inventory.controller.ts`

---

## 3. STUB Comments

**Found: 1 STUB**

| File | Line | Content |
|---|---|---|
| `src/modules/sales/sales.service.ts` | 30 | `// STUB: In real implementation, validate user exists in store` |

The `createSale()` method skips user-store validation. The commented-out code shows the intended check but it is not active, meaning any `userId` string is accepted without verification.

---

## 4. CustomerSession & AuditLog Controllers

**Status: MISSING — Neither has a controller, service, or module**

Both `CustomerSession` and `AuditLog` exist only as TypeORM entities under `src/database/entities/`. There are no corresponding files in `src/modules/`:

- No `customer-session.controller.ts`
- No `customer-session.service.ts`
- No `customer-session.module.ts`
- No `audit-log.controller.ts`
- No `audit-log.service.ts`
- No `audit-log.module.ts`

Similarly, `OutfitRecommendation`, `OutfitRecommendationItem`, and `AiProcessingJob` also lack modules/controllers/services. These entities are registered in `app.module.ts` TypeORM config but have no API endpoints.

---

## 5. Missing Imports & Broken Dependencies

| Issue | Severity | Fix |
|---|---|---|
| `@types/uuid` not in devDependencies | HIGH — blocks build | `npm i -D @types/uuid` |
| `strictPropertyInitialization` conflicts with TypeORM | HIGH — blocks build | Set `false` in tsconfig or add `!` to all entity props |
| `package-lock.json` missing | MEDIUM | Run `npm install` to generate |
| No actual broken `import` statements found | OK | All `@/...` path aliases resolve correctly |

All module cross-imports (e.g., `AuthModule` imported in `InventoryModule`) are structurally correct. The `@/*` path alias in `tsconfig.json` maps to `./src/*` and all referenced files exist.

---

## 6. File Comparison vs BACKEND_COMPLETED.md

### Expected files that EXIST:

| Section | Files | Status |
|---|---|---|
| Project Config | `package.json`, `tsconfig.json`, `nest-cli.json`, `.env`, `.env.example` | All present |
| Bootstrap | `src/main.ts`, `src/app.module.ts` | All present |
| Database Config | `src/config/database.config.ts` | Present |
| Entities (12) | store, user, clothing-category, clothing-item, size-stock, sale, sale-line, customer-session, outfit-recommendation, outfit-recommendation-item, ai-processing-job, audit-log | All present |
| Entity Exports | `src/database/index.ts` | Present |
| Auth Module (9) | controller, service, jwt.strategy, jwt-auth.guard, roles.guard, roles.decorator, module, dto/login, dto/register | All present |
| Users Module (3) | service, controller, module | All present |
| Store Module (3) | service, controller, module | All present |
| Inventory Module (6) | service, controller, module, dto/create-item, dto/update-item, dto/reduce-stock | All present |
| Sales Module (4) | service, controller, module, dto/create-sale | All present |
| Seed | `src/database/seed.ts` | Present |
| Docs | README, ARCHITECTURE, QUICK_START, FILE_STRUCTURE, .gitignore | All present |

### Extra files (not in BACKEND_COMPLETED.md):

| File | Purpose |
|---|---|
| `src/modules/index.ts` | Barrel export for all modules |
| `src/modules/auth/current-user.decorator.ts` | `@CurrentUser()` param decorator |
| `src/modules/inventory/classification.service.ts` | Google Cloud Vision API integration for image classification |
| `DOCS_INDEX.md` | Documentation index |
| `MANIFEST.txt` | File manifest |

### Missing files:

No files listed in BACKEND_COMPLETED.md are missing from disk. However, the doc claims "60+ files" and "4000+ lines" — the actual `src/` directory has **45 TypeScript files**, which is consistent when counting docs and config.

---

## Summary

| Check | Result |
|---|---|
| `npm install` | OK |
| `npm run start:dev` | FAILS (132 TS errors) |
| STUB comments | 1 found (sales user validation) |
| CustomerSession controller | MISSING |
| AuditLog controller | MISSING |
| Missing imports | `@types/uuid` only |
| Files vs BACKEND_COMPLETED.md | All documented files present; 5 extra files found |

### Priority Fixes (to get the project running):

1. `npm install --save-dev @types/uuid`
2. Add `"strictPropertyInitialization": false` to `tsconfig.json` compilerOptions
3. Then `npm run start:dev` should compile (requires PostgreSQL running with matching `.env` credentials)
