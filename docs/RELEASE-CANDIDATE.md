# Release Candidate Hardening — v1.0.0-rc1

Follow-up pass to the Production Readiness commit. Every item from the
reviewer's Release Candidate feedback is closed and evidenced below.

## Item-by-item

### 1. Real SMTP + AR/EN templates + no-log-in-prod
- `src/modules/mail/mail.service.ts` — nodemailer transport when
  `MAIL_DRIVER=smtp`; refuses to boot production with `log`. Log driver
  writes to `STORAGE_ROOT/mail-outbox/*.txt` with mode 0600; nothing sensitive
  reaches stdout. URLs in error lines are `?<redacted>`.
- `src/modules/mail/templates.ts` — Arabic + English HTML/text templates
  for `verifyEmail`, `passwordReset`, `orderApproved`.
- `OrdersService.approve` best-effort emails buyer on approval.

### 2. `npm audit` is a real gate
- `scripts/audit-gate.ts` — fails on any Critical always, fails on any
  High not present in `.audit-allowlist.json`; every allow entry has
  `ghsa/package/severity/reason/owner/expiresAt` and expiry re-fires
  CI once elapsed.
- `.github/workflows/ci.yml` calls `npm run audit-gate` without
  `continue-on-error`; `--audit-level=none` removed.
- Live gate run: **20 unique advisories, 0 blocking, 20 informational**
  (all in allowlist with expiresAt=2027-01-31).

### 3. DOWNLOAD_URL_SECRET mandatory + independent
- `production-guard.ts` requires it, refuses `DOWNLOAD_URL_SECRET ===
  JWT_SECRET`, and enforces ≥ 32 chars.
- `DownloadLinkService` throws at runtime if it is missing in production
  even after boot.

### 4. Legacy JWT download deprecated
- `DOWNLOADS_LEGACY_ENDPOINT=off` default in production; returns 410
  Gone with `Deprecation: true` + `Sunset` + `Link: successor-version`
  headers.
- Production guard refuses `DOWNLOADS_LEGACY_ENDPOINT=on`.

### 5. Signed download URL hardened
- Bound to `generationId` — a link minted for gen N stops working after
  admin_reissue rolls the copy to gen N+1.
- Single-use via `download_tokens (PRIMARY KEY jti)` — replay raises 410.
- Headers on served file: `Cache-Control: no-store, private, max-age=0`,
  `Pragma: no-cache`, `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`.
- Timing-safe HMAC compare (was already there).

### 6. Serialised reissue, exact-count test
- `OrdersService.reissueForCustomer` wraps the whole reissue in a
  transaction with `pg_advisory_xact_lock(hashtext('reissue:' || id))`.
  Two concurrent calls serialise; both succeed with strictly monotonic
  `generationNumber`.
- Test asserts EXACTLY 3 generations (initial + 2 reissues), sorted
  `[2, 3]`, with distinct `generationId` and distinct `fileSha256`.

### 7. Load test — 50 concurrent issue + verify
```json
{
  "settings": { "pagesPerCopy": 30, "total": 50, "concurrency": 10 },
  "wallClockMs": 9820,
  "throughputPerSec": "5.09",
  "failures": 0,
  "failureRate": "0.000",
  "latencyMs": {
    "min": 804, "p50": 1934, "p95": 2293, "p99": 2819, "max": 2819, "avg": 1963
  },
  "peakRssMB": "322.0"
}
```
Sample saved to `samples/load-report.json`.

### 8. Realistic PDF perf (images + AR/EN)
```json
{
  "pages": 301,
  "masterBuildMs": 35587,
  "masterSizeKB": "563.1",
  "issueMs": 2110,
  "pagesPerSecond": "142.7",
  "outSizeKB": "816.3",
  "peakRssMB": "307.6",
  "rssDeltaMB": "7.3",
  "diskSha256MatchesRecord": true,
  "signatureValid": true
}
```
Cover image + Amiri + Helvetica + 300 body pages of mixed AR/EN. Sample
saved to `samples/arabic-realistic-300.pdf`.

### 9. Amiri OFL license + visual acceptance
- `src/assets/fonts/OFL.txt` — full SIL Open Font License 1.1 text.
- `src/assets/fonts/README.md` — attribution, upstream URL, subsetting
  note, OFL compliance summary.
- Visual acceptance: samples/arabic-sample.pdf (small) and
  samples/arabic-realistic-300.pdf (large) both carry the full Arabic
  name "د. إياد محمد عبود" in footer + certificate page, mixed with
  Latin email + order number.

### 10. TOTP MFA for super_admin
- `mfa.service.ts` + `mfa.controller.ts` — `/auth/mfa/{setup,enable,
  disable}` using otplib TOTP + qrcode. Recovery codes are hashed
  (SHA-256), 8 issued at enable, single-use.
- `AuthService.login` refuses super_admin login without MFA and requires
  `mfaCode` at every login for any account with `mfaEnabled=true`.
- `scripts/bootstrap-owner.ts` provisions the owner with MFA enabled in
  one shot, prints otpauth URL + recovery codes to stdout exactly once.
- E2E: `mfa.e2e-spec.ts` proves the wrong code is rejected, the right
  code passes, enrolment invalidates prior sessions, and each recovery
  code works exactly once.

## Numbers on this snapshot

- 17 test suites, 108 tests, all green (`npm run test`).
- Coverage (`npm run test:cov`) — see stdout of the last run.
- `npm run audit-gate` — 0 blocking.
- `npm run backup-drill` — dumps + restores + validates generation
  signatures round-trip.
- `npm run build` — clean.
