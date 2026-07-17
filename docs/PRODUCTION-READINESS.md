# Production Readiness Checklist — منصة القراءة القصدية

Live verification snapshot at the last commit on
`claude/project-mvp-design-tuuz11`.

| # | Requirement | State | Evidence |
|---|-------------|-------|----------|
| 1 | Build compiles with strict TS | ✅ | `npm run build` → exit 0 |
| 2 | All tests pass on real Postgres | ✅ | 90/90 (`npm run test`) |
| 3 | Line coverage ≥ 70% | ✅ | 77.96% (`npm run test:cov`) |
| 4 | Native Arabic PDF rendering | ✅ | Amiri font, reshaper + bidi; `samples/arabic-sample.pdf` |
| 5 | 300-page Arabic perf test | ✅ | 144 pages/s issue, 1 ms verify — `samples/arabic-perf-300.pdf` |
| 6 | HMAC signature bound to file bytes | ✅ | `signing.spec.ts`, `signing-rotation.spec.ts` |
| 7 | HMAC scope explicitly documented (byte-exact, not perceptual) | ✅ | `docs/IRPB-COMPLIANCE-MATRIX.md`, `README.md`, `fingerprint.service.ts` |
| 8 | Key rotation without breaking old signatures | ✅ | `signing-rotation.spec.ts` — k1-signed valid after activating k2 |
| 9 | 15 open advisories triaged one-by-one | ✅ | `docs/SECURITY-ADVISORIES.md` |
| 10 | Production boot guard | ✅ | `production-guard.spec.ts` — 9 rules, all covered |
| 11 | Path traversal / MIME / magic-byte guards | ✅ | `safe-path.spec.ts`, `uploads.e2e-spec.ts` |
| 12 | CMS: sanitized + versioned + draft/publish + audit | ✅ | `cms.e2e-spec.ts` + `sanitize.spec.ts` |
| 13 | RBAC six roles enforced + schema trigger for super_admin | ✅ | `rbac.e2e-spec.ts` |
| 14 | Session invalidation on password reset/change | ✅ | `auth.e2e-spec.ts` |
| 15 | Hashed single-use password reset tokens | ✅ | `auth.e2e-spec.ts` + entity has `tokenHash` column |
| 16 | Idempotent approval + concurrent-safe reissue | ✅ | `idempotency.e2e-spec.ts` |
| 17 | Signed short-TTL download URLs | ✅ | `signed-downloads.e2e-spec.ts` + `download-link.spec.ts` |
| 18 | Rate limits documented + Redis-ready | ✅ | `docs/RATE-LIMITS.md`, `AppModule` throttler |
| 19 | Helmet security headers | ✅ | `main.ts` — CSP `default-src 'none'` |
| 20 | Migrations only in production (no synchronize) | ✅ | `data-source.ts` + `RoleHardening` migration |
| 21 | Backup restore drill verifies signatures round-trip | ✅ | `scripts/backup-restore-drill.sh` — ran live, 2 real generation rows |
| 22 | CI runs build + unit + E2E + audit on Postgres + Redis | ✅ | `.github/workflows/ci.yml` |
| 23 | Verify-copy CLI works offline | ✅ | `bin/verify-copy.ts` |
| 24 | Compliance matrix maps IRPB → code + test | ✅ | `docs/IRPB-COMPLIANCE-MATRIX.md` |
| 25 | DB schema doc lists tables/fields/indexes | ✅ | `docs/DB-SCHEMA.md` |

## Test run summary

Ran locally against real PostgreSQL 16 + in-memory Throttler + dev signing key.

```
Test Suites: 16 passed, 16 total
Tests:       90 passed, 90 total
Statements   : 75.43% ( 1139/1510 )
Branches     : 61.83% ( 546/883 )
Functions    : 57.79% ( 152/263 )
Lines        : 77.96% ( 1026/1316 )
```

### Suites

- Unit (9 files, 70 tests): `signing`, `signing-rotation`, `safe-path`,
  `sanitize`, `user-agent`, `arabic-shape`, `roles-guard`,
  `production-guard`, `download-link`.
- E2E (7 files, 20+ tests): `auth`, `rbac`, `purchase-flow` (register →
  approve → download → reissue → offline signature verify), `cms`,
  `uploads`, `idempotency`, `signed-downloads`.

## Perf snapshot

```json
{
  "pages": 300,
  "masterBuildMs": 61536,
  "masterSizeKB": "363.6",
  "issueMs": 2076,
  "pagesPerSecond": "144.5",
  "diskHashMs": 2,
  "diskSha256MatchesRecord": true,
  "signatureValid": true,
  "verifyMs": 1,
  "outSizeKB": "604.5"
}
```

Interpretation:
- **Issuing a 300-page Arabic PDF takes ~2 seconds** on this container's
  CPU. Well inside IRPB file 4 §12 ("within seconds").
- **Signature verification is 1 ms** — a full audit sweep across thousands
  of generations is single-digit seconds.
- **Byte-integrity round trip proven**: on-disk SHA-256 matches the DB
  record, and the signature validates.

## Known Partial / Missing (unchanged from prior report)

- **EmailTemplates table** — inline strings, MailService logs the URL in
  MVP; SMTP integration is a small drop-in. v2.
- **MFA for admin roles** — v2.
- **Perceptual hashing / steganographic marks for post-OCR/re-compression
  identification** — v2 (documented in the HMAC clarification).
- **Explicit load / stress test in CI** — the perf script is available as
  `scripts/perf-issue.ts` but isn't part of CI runs (would add minutes).
- **Frontend accessibility / responsive / dark mode** — out of backend scope.

Everything else in `docs/IRPB-COMPLIANCE-MATRIX.md` is Implemented.

## Runbooks

- Bring up a fresh production DB:
  ```
  npm ci --omit=dev
  npm run migration:run
  npm run seed
  ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_FULL_NAME=… npm run bootstrap:owner
  ```
- Rotate the copy signing key:
  ```
  # 1) add the new key to the ring (env or file):
  export COPY_SIGNING_KEYS='[{"id":"k1","hex":"…"},{"id":"k2","hex":"…"}]'
  # 2) redeploy — signatures still made with k1, verifications work for both
  # 3) flip active:
  export COPY_SIGNING_ACTIVE_KEY_ID=k2
  # 4) redeploy — new sigs use k2, old sigs still verify with k1
  # 5) once every k1-signed generation is archived, drop k1 from the ring
  ```
- Verify a suspected leak:
  ```
  # take the copy UUID / generation id off the leaked file's certificate page
  psql -c "SELECT \"signedPayload\", signature FROM issued_copy_generations
           WHERE \"generationId\" = '<gen id>'" > /tmp/sig-and-payload.txt
  COPY_SIGNING_KEY_FILE=/etc/qasdiya/copy.key npm run verify-copy -- \
      --payload /tmp/payload.json --sig /tmp/sig.json --file /tmp/leaked.pdf
  ```
- Restore drill (monthly):
  ```
  npm run backup-drill
  ```
