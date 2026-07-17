# Post-launch backlog

Items that were consciously not shipped in `v1.0.0-rc1` but must be closed
before the platform grows beyond a small first-cohort of buyers. Each has an
owner (technical maintainer), a business risk-owner, and a target sprint.

## 1. Durable mail queue + retry

### Current behaviour

- `MailService.sendOrderApprovedEmail` is invoked from
  `OrdersService.approve` as **best-effort** (`.catch(() => undefined)`).
  If SMTP is temporarily down or the message is rate-limited, the approval
  itself still commits — the buyer gets a personal copy and a signed
  download link, but no e-mail notification.
- `sendVerificationEmail` and `sendPasswordResetEmail` bubble errors up to
  the HTTP caller — a failed SMTP round-trip becomes a 5xx and the token
  is orphaned in the DB until it expires.

### What we need before launch grows

- **A `mail_outbox` table** with columns `id, to, subject, textBody,
  htmlBody, status ('pending'|'sending'|'sent'|'failed'), attempts,
  lastError, nextAttemptAt, sentAt, createdAt`.
- **Insert on request** — `MailService.send()` writes to `mail_outbox`
  transactionally with the business event (approve, register, reset), then
  a background worker delivers.
- **A worker loop** (in-process or separate process) that polls `pending`
  rows with `nextAttemptAt <= now()`, moves them to `sending` via
  `UPDATE ... RETURNING`, hands them to nodemailer, then transitions to
  `sent` on 250/success or `failed` after N attempts with exponential
  backoff.
- **An admin endpoint** to re-drive a `failed` row and to view the last
  few `pending` items.
- **Metric**: emit `mail.queue.pending`, `mail.queue.failed`, and
  `mail.queue.delivery_seconds` so a dashboard can alarm.
- **Idempotency key** on the insert so a retried business flow does not
  duplicate the message.
- **Approve must not fail if SMTP is down** — the row is already queued;
  the fingerprint / download flow completes.

### Owner + risk owner

- Technical owner: `security@qasdiya.local` (developer/security).
- Risk owner: Dr. Iyad.
- Target: first sprint after v1.0.0.

## 2. Idempotency key on reissue

### Current behaviour

`POST /orders/:id/reissue-copy` is fully serialised by a Postgres advisory
lock, so two concurrent clicks produce two distinct generations
sequentially — deterministic and traced, but wasteful if the buyer
double-clicked by accident.

### Desired

Accept an optional `Idempotency-Key` HTTP header (RFC-9110 style). Store
`(userId, key)` in a small `reissue_idempotency` table with the resulting
`generationId`. A second request with the same key inside a 10-minute
window returns the same generation record without producing a new one.

- Owner: `security@qasdiya.local`.
- Risk owner: Dr. Iyad.
- Target: same first sprint.

## 3. Advisory sweep every 90 days

`.audit-allowlist.json` enforces `maxExpiryDays: 90`. When an entry
expires, CI blocks. That is intentional. The technical owner must:

1. Re-run `npm audit --omit=dev` for a fresh advisory list.
2. For each still-open advisory, check whether upstream shipped a fix
   (bump the dep if so — the advisory drops off automatically).
3. If still open, re-triage the mitigation and, only if it still holds,
   renew the entry with a new `expiresAt` (again ≤ 90 days) and mark
   `lastReviewedAt` in the policy block.
4. Business owner countersigns by keeping their name in `riskAcceptedBy`.

## 4. Move off `bcrypt` native prebuild chain (bcrypt → tar advisory)

`bcrypt` pulls `@mapbox/node-pre-gyp` → `tar` which carries a large stack
of install-time advisories. All are install-time only and never on our
runtime path, but the cleanest fix is to replace `bcrypt` with `argon2` or
`@node-rs/argon2` at the next quarterly review. Argon2 is also the
current OWASP recommendation for password storage.

## 5. Front-end + UAT

Backend is Release Candidate ready. The next major work is:

- The public Arabic/English site (Next.js recommended — already an
  API-first design so any framework fits).
- User dashboard for orders / downloads / MFA setup.
- Admin dashboard consuming `/admin/*` endpoints.
- Accessibility audit (WCAG 2.2 AA) + RTL/LTR mirror pass.
- UAT with a first cohort of readers.

## 6. Operations post-launch checklist

- Verify `/mail-outbox` on disk is empty (log-driver is refused in prod).
- Confirm the backup drill runs weekly (add cron entry per
  `docs/BACKUP.md`).
- Confirm the audit gate cron re-runs `npm audit` and pages on expiry.
- Enrol a second super_admin (owner + backup owner) with distinct MFA
  devices in case one is lost.
- Test a full outage → restore drill on a staging clone before month one.
