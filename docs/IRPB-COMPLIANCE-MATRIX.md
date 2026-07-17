# مصفوفة الامتثال لمرجع IRPB — Compliance Matrix

يربط هذا الملف كل بند من الملفات الستة للمرجع التأسيسي IRPB
بالملف/المسار/الاختبار الذي يثبته، مع الحالة الصريحة:

- **Implemented** — منفَّذ ومغطًّى باختبار.
- **Partial** — منفَّذ لكن ينقصه شيء موثَّق.
- **Missing** — غير منفَّذ ومسجَّل صراحةً.

## File 1 — Foundation & Governance

| البند | الحالة | الدليل |
|---|---|---|
| اسم/شعار/وصف/مالك | Implemented | `docs/CONSTITUTION.md`, `README.md` |
| دستور المنصة (5 مواد) | Implemented | `docs/CONSTITUTION.md` |
| ملكية الأصول للمالك | Implemented | `LICENSE`, `docs/CONSTITUTION.md` |
| Vendor Independence | Implemented | Node.js + Postgres + TypeORM open-source stack, no proprietary SDKs |
| Multi-language Ready | Implemented | JSONB `title/author/description/name` per entity — `test/unit/*.spec.ts` covers pick logic |
| Privacy by Design | Implemented | Consent required to register (`AuthService.register` + `RegisterDto`); email hashing not stored, tokens hashed |
| Auditability | Implemented | `AuditService.record`, table `audit_logs`, wired at every mutation (register/login/order/copy/CMS/reset) |

## File 2 — Business & Functional

| البند | الحالة | الدليل |
|---|---|---|
| تسجيل مستخدم | Implemented | `POST /auth/register` → `test/e2e/auth.e2e-spec.ts` "register → verify → login" |
| تسجيل دخول | Implemented | `POST /auth/login` → same E2E |
| استعادة كلمة المرور | Implemented | `POST /auth/forgot-password` + `/reset-password` → E2E "forgot-password issues a single-use, time-limited token" |
| تعديل الملف الشخصي | Implemented | `PATCH /auth/me` → RBAC E2E asserts role field cannot be set |
| استعراض الكتب / تفاصيل | Implemented | `GET /books`, `GET /books/:slug` → covered indirectly in purchase-flow E2E |
| البحث + التصنيف + الكلمات المفتاحية | Implemented | `BooksService.listPublic` (query builder) — no dedicated E2E, marked **Partial: functionality lives, dedicated test to add** |
| صفحة مستقلة لكل كتاب | Implemented | `GET /books/:slug` |
| عينة مجانية | Implemented | `GET /books/:slug/sample` + `Book.samplePdfPath` |
| اتفاقية الشراء | Implemented | `Order.agreementAccepted` + `CreateOrderDto.agreementAccepted` (`Equals(true)`) |
| إنشاء الطلب | Implemented | `POST /orders` → purchase-flow E2E |
| رفع صورة الحوالة | Implemented | `POST /orders/:id/transfer-proof` + magic-byte check → uploads E2E |
| اعتماد الطلب → إنشاء نسخة | Implemented | `POST /admin/orders/:id/approve` → purchase-flow E2E |
| رفض الطلب مع السبب | Implemented | `POST /admin/orders/:id/reject` |
| متابعة حالة الطلب + سجل | Implemented | `GET /orders`, `GET /orders/:id` |
| RBAC 6 أدوار | Implemented | `src/modules/auth/roles.ts` + `docs/RBAC.md` + `test/e2e/rbac.e2e-spec.ts` (5 role scenarios) |
| Rafidain + TBI-IQD + TBI-USD | Implemented | `seed.ts` seeds all three; admin CRUD tested at unit level |
| تقارير: مبيعات، أكثر مبيعاً، معلقة | Implemented | `GET /admin/reports/{sales,best-selling,pending-orders}` |
| المقالات + وسوم + SEO | Implemented | `Article.category/tags/metaTitle/metaDescription`; endpoints + admin CRUD — **Partial: no dedicated E2E** |
| قواعد العمل — لا شراء دون حساب | Implemented | `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(...CUSTOMER_ROLES)` on `/orders` |
| قواعد العمل — لا تنزيل قبل الاعتماد | Implemented | `DownloadsService.prepareDownload` → forbids unless `status='fulfilled'` |
| قواعد العمل — UUID مستقل لكل شراء | Implemented | `IssuedCopy.copyUuid` unique; `randomUUID()` on first issue; reissue keeps it |
| قواعد العمل — لا إعادة استخدام PDF جاهز | Implemented | `FingerprintService.issueCopyForOrder` builds a fresh file every time |
| قواعد العمل — كل إنشاء يُسجَّل | Implemented | `AuditService.record('order.approved' | 'copy.reissued' | 'copy.admin_reissued')` |

## File 3 — Technical Architecture

| البند | الحالة | الدليل |
|---|---|---|
| Vendor Independent | Implemented | Node/Nest/TypeORM/Postgres; no SaaS lock-in |
| API First | Implemented | Entire surface is `/api/v1/*` |
| Modular Architecture | Implemented | 12 modules under `src/modules/*` |
| Security by Design | Implemented | JWT + RolesGuard + Helmet + Throttler + hashed tokens + signed copies + magic-byte upload check + path-traversal guard |
| Scalability | Partial | Redis-backed Throttler when `REDIS_URL` set; DB schema uses indexes; horizontal scaling requires session store — not covered by tests |
| Maintainability | Implemented | 76% line coverage / 54 tests / migrations gate all schema changes |
| Layered structure (UI/App/Business/Publishing/DB/Storage) | Implemented | Publishing Engine lives in `modules/fingerprint`; Storage in `storage/`; DB in Postgres |
| Entities: Users/Roles/Permissions/Books/BookFiles/BookSamples/Articles/Orders/OrderItems/Payments/Downloads/Watermarks/Fingerprints/AuditLogs/Settings/EmailTemplates | Partial | RBAC lives inline (`users.role` + role sets) instead of Roles/Permissions tables; OrderItems collapsed into `Order` since MVP is one book per order; Payments folded into `OrderTransferProof`; Watermarks + Fingerprints merged into `IssuedCopy` + `IssuedCopyGeneration`; BookSamples is a field on `Book`; EmailTemplates **Missing** — mailer uses inline strings, template table is v2 |
| REST API examples | Implemented | See `README.md` endpoints table |
| RBAC (6 roles) | Implemented | See File 2 row above |
| HTTPS only | Implemented as guidance | `docs/DEPLOYMENT.md` (server-level); no code enforcement (correct — proxy responsibility) |
| Password Hashing | Implemented | bcrypt cost 12 by default |
| CSRF | Partial | API is stateless JWT (Bearer); no cookie session, so no CSRF vector by design. Documented in `docs/RATE-LIMITS.md`. |
| XSS Protection | Implemented | Helmet + CSP `default-src 'none'`; CMS sanitizer strips scripts/handlers/`javascript:` — unit tested |
| SQL Injection | Implemented | TypeORM parameterized queries throughout; no string interpolation on user input |
| Rate Limiting | Implemented | `@nestjs/throttler` + Redis storage when `REDIS_URL` present; per-endpoint overrides documented in `docs/RATE-LIMITS.md` |
| MFA للإدارة مستقبلاً | Missing | Deferred — no code today |
| Audit Logging | Implemented | See File 1 row |
| VPS / Ubuntu / Nginx / PostgreSQL / Redis / Backups / Monitoring | Implemented as guidance | `docs/DEPLOYMENT.md` + `docs/BACKUP.md` |
| Daily/weekly/monthly backups + restore test | Implemented | `docs/BACKUP.md` documents cadence; `scripts/backup-restore-drill.sh` verified live (Jul 2026 run: 2 real generation rows round-tripped OK) |
| CI/CD ready | Partial | Test scripts and `nest build` present; no `.github/workflows` shipped (out of MVP scope) |

## File 4 — Digital Publishing Engine

| البند | الحالة | الدليل |
|---|---|---|
| No pre-baked per-buyer PDF | Implemented | `FingerprintService.issueCopyForOrder` reads master + writes generated on every call |
| Master PDF stays on the server | Implemented | `storage/books/` is never publicly served; only `/downloads/order/:id` exposes generated per-user files |
| Generation only after payment approved | Implemented | `OrdersService.approve` is the only initial-issue trigger; RBAC restricted to finance-admin |
| Copy lifecycle (§2) — approve → load master → UUID → inject → fingerprints → sign → log → publish | Implemented | All 8 steps present in `issueCopyForOrder`; audit log entry per step |
| Embedded data (name/email/phone/country/order#/UUID/edition) | Implemented | See `buildHiddenPayload` + certificate page + metadata |
| Identification/tracking/deterrence mechanisms (§4) | Implemented | Six mechanisms enumerated below with explicit limits |
| UUID unique per purchase, non-reused | Implemented | `IssuedCopy.copyUuid UNIQUE`; reissue reads existing to preserve it |
| Generation history + independent hash per file | Implemented | `IssuedCopyGeneration` table; each row has its own `generationId`, `generationNumber`, `filePath`, `fileSha256`, `signedPayload`, `signature`. Test: purchase-flow E2E asserts generation numbers 1 and 2 with distinct IDs and hashes |
| Download log (date/IP/browser/OS/UUID/order#) | Implemented | `download_logs` + UA parser; `DownloadsService.prepareDownload` writes on every download |
| Reissue by user with same UUID | Implemented | `POST /orders/:id/reissue-copy` → asserted in purchase-flow E2E |
| No direct file access | Implemented | `/storage/*` not statically served; downloads go through JwtAuthGuard + owner check |
| Temporary download links | Missing | Currently permanent authenticated URLs. Signed short-TTL URLs are a v2 line item — flagged. |
| Log every access attempt | Partial | Successful downloads land in `download_logs`; failed attempts (401/403) land only in the audit log |
| Admin: search by UUID / buyer / order# | Implemented | `GET /admin/lookup/copies?buyer=&order=` + `GET /admin/lookup/copy/:uuid` |
| Forensic report | Implemented | `GET /admin/lookup/copy/:uuid/report(.pdf)` — includes report number, sha256, timestamp, issuer identity, generation history with per-generation signature verification |

### The six on-file mechanisms — capabilities AND limits (rewritten per feedback)

1. **Visible footer with buyer name/email + order#** — deters casual sharing. **Removed by page cropping.**
2. **Diagonal semi-transparent watermark across the page** — increases the effort to redact. **Removed by re-rendering, OCR + reflow, or high-contrast masking.**
3. **UUID + edition marker in every page corner** — redundant identifier that survives header/footer edits. **Removed by cropping.**
4. **Signed PDF metadata (Title/Author/Subject/Keywords)** — first-place a metadata dump reveals identity. **Removed by any tool that strips PDF metadata.**
5. **Trailer certificate page with the full JSON payload** — human-readable identity anchor. **Removed by deleting the last page.**
6. **Detached HMAC-SHA256 signature stored in the database (out of the file)** — this is the **only** mechanism an attacker cannot strip from a leaked file, because it does not live in the file. Combined with the SHA-256 of every generation, it lets us tie a specific copy of a specific generation to its buyer.

None of the file-embedded layers 1–5 is cryptographic prevention. Their job is redundancy so that layer 6 has multiple independent identifiers to correlate against a leak.

## File 5 — UI/UX Design (backend-visible items)

| البند | الحالة | الدليل |
|---|---|---|
| Home / about / founder / FAQ / contact | Implemented | `GET /content/:key` with allowed keys `page.home_hero/about/founder/faq/contact/purchase.agreement` |
| Featured books on home | Implemented | `Book.isFeatured` + `?featured=true` filter |
| Book page: cover/title/description/toc/sample/price/buy | Implemented (backend fields) | `Book.coverImagePath/samplePdfPath/priceUsd/priceIqd` |
| User dashboard: profile / orders / downloads / reissue / change-password | Implemented | `/auth/me`, `/orders`, `/downloads/order/:id`, `/orders/:id/reissue-copy`, `/auth/change-password` |
| Admin panel: dashboard/orders/books/articles/customers/settings/reports/audit-log | Implemented | `/admin/summary/reports/orders/books/articles/customers/content/downloads` |
| Accessibility / Responsive / Dark mode | Missing | Frontend concerns; out of backend scope. Documented. |

## File 6 — QA · Operations · Deployment

| البند | الحالة | الدليل |
|---|---|---|
| Functional QA (register/login/reset/order/upload/approve/copy/download) | Implemented | `test/e2e/{auth,purchase-flow,uploads,rbac,cms}.e2e-spec.ts` — 20 E2E |
| Non-functional QA (perf/security/load/backup/restore) | Partial | Security: `test/unit/*` covers signing/safe-path/sanitize/UA parsing (34 unit tests). Backup/restore: `scripts/backup-restore-drill.sh` run live. Perf and load are not automated. |
| Acceptance criteria — code / DB / docs / passwords / training | Partial | Code + DB + docs delivered here; password/training handover is out-of-repo. |
| Operations manuals | Implemented | `docs/OPERATIONS.md` |
| Deployment | Implemented | `docs/DEPLOYMENT.md` |
| Backups | Implemented | `docs/BACKUP.md` + working `scripts/backup-restore-drill.sh` |
| Risk register | Partial | Deployment doc lists infra risks; no separate risk-per-response document — flagged |
| Ownership | Implemented | `LICENSE` + `docs/CONSTITUTION.md` |
| Delivery list | Implemented | `docs/CONSTITUTION.md` §9 |
| Maintenance schedule | Implemented | `docs/OPERATIONS.md` §10 |
| Post-MVP roadmap | Implemented | `README.md` roadmap section |

## Open items summarised

| Item | Status | Owner |
|---|---|---|
| EmailTemplates table | Missing | v2 — inline strings today |
| Temporary signed download URLs | Missing | v2 — permanent authenticated links today |
| MFA for admin roles | Missing | v2 |
| Roles/Permissions tables | Partial | Enum + role-set constants today; table split when we need custom role mixes |
| Books search / articles search / articles tags — dedicated E2E | Partial | Functionality lives + unit-tested; E2E to add |
| Multer 2.x DoS advisories | Partial | Upgraded to 2.2.0 (latest); advisories still open upstream — mitigated by size limit + rate limit |
| Failed-download-attempt logging | Partial | AuditLog only; no dedicated per-attempt log yet |
| CI/CD workflow | Missing | Out of MVP scope; add a `.github/workflows/ci.yml` running `npm ci && npm run build && npm test` when ready |
| Load / performance testing | Missing | Not automated |
