# Anaqat Al-Iraq — Operations Runbook

Execution-oriented. Every section is a sequence of commands; no narration.

---

## 1 · Required environment variables

Boot fails (exit 1, `[bootstrap] fatal: Config validation error`) if any required value is missing or invalid. Enforced by `src/config/validation.schema.ts`.

| Var | Required in prod | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | ✔ | `production` | |
| `JWT_SECRET` | ✔ | `openssl rand -base64 48` | ≥16 chars |
| `DB_HOST` | ✔ | `db.internal` | |
| `DB_PORT` | default 5432 | `5432` | |
| `DB_USERNAME` | ✔ | `anaqat_app` | |
| `DB_PASSWORD` | ✔ | `<secret>` | refused if `=postgres` in prod |
| `DB_DATABASE` | ✔ | `anaqat_iraq` | |
| `DB_SSL` | recommended | `true` | |
| `DB_SSL_REJECT_UNAUTHORIZED` | default `true` | `true` | set `false` only for self-signed |
| `CORS_ORIGIN` | ✔ | `https://app.example.com` | comma-sep list; `*` refused in prod |
| `APP_BASE_URL` | ✔ | `https://api.example.com` | used for upload URLs |
| `PORT` | default 3000 | `3000` | |
| `JWT_EXPIRATION` | default 24h | `24h` | |
| `THROTTLE_TTL` | default 60 | `60` | seconds |
| `THROTTLE_LIMIT` | default 120 | `120` | req/IP/window |
| `BODY_LIMIT` | default 1mb | `1mb` | |
| `UPLOAD_DIR` | default `uploads` | `/var/lib/anaqat/uploads` | |
| `GOOGLE_VISION_API_KEY` | optional | — | classify falls back to manual if unset |

---

## 2 · First deploy (fresh cluster, empty DB)

```bash
# 1. Build once (deploy host or CI)
npm ci --legacy-peer-deps
npm run build

# 2. Create the DB (DBA task — outside the app)
createdb -h "$DB_HOST" -U "$DB_USERNAME" "$DB_DATABASE"

# 3. Apply schema via migration (never synchronize)
NODE_ENV=production npm run migration:run

# 4. Start the app (orchestrator / systemd / docker)
NODE_ENV=production npm run start:prod

# 5. Verify readiness (see §6)
curl -fsS http://localhost:3000/healthz
```

---

## 3 · First deploy (container / docker compose)

```bash
# 1. Build the image
docker build -t anaqat-backend:latest .

# 2. Start Postgres + run migrations + start app
docker compose up -d postgres
docker compose run --rm migrate              # applies InitialSchema + any new migrations
docker compose up -d app

# 3. Tail logs
docker compose logs -f app

# 4. Verify
curl -fsS http://localhost:3000/healthz
open http://localhost:3000/api-docs
```

---

## 4 · Subsequent deploys (schema change)

Developer:
```bash
# Generate a migration from the entity diff, review the SQL, commit
npm run migration:generate -- src/database/migrations/DescriptiveName
git add src/database/migrations && git commit
```

CI / deploy host, in order:
```bash
# 1. Pull the new image/build
docker pull anaqat-backend:<new-tag>        # or `npm run build` on a VM

# 2. Apply any new migrations BEFORE starting the new version
docker run --rm --env-file .env anaqat-backend:<new-tag> \
  npm run migration:run:prod

# 3. Restart the app with the new image
docker compose up -d --no-deps app          # (or k8s rollout restart)

# 4. Re-verify
curl -fsS http://localhost:3000/healthz
```

---

## 5 · Rollback

### 5a · App rollback only (no schema change in the failed deploy)

```bash
docker compose up -d --no-deps app          # redeploy previous image tag
# or: kubectl rollout undo deployment/anaqat-backend
```

### 5b · Rollback including a schema change

```bash
# 1. Roll back the app to the previous image
docker pull anaqat-backend:<previous-tag>

# 2. Revert the last migration
docker run --rm --env-file .env anaqat-backend:<previous-tag> \
  npm run migration:revert:prod

# 3. Restart
docker compose up -d --no-deps app

# 4. Verify
curl -fsS http://localhost:3000/healthz
```

Caveat — `migration:revert` reverts **only the last** migration. If multiple migrations shipped, revert once per migration, in reverse order.

### 5c · Existing DB built with synchronize (one-time baseline)

```sql
-- Mark InitialSchema as already applied so migration:run doesn't re-CREATE.
psql -d anaqat_iraq <<'SQL'
CREATE TABLE IF NOT EXISTS typeorm_migrations (
  id SERIAL PRIMARY KEY,
  timestamp bigint NOT NULL,
  name varchar NOT NULL
);
INSERT INTO typeorm_migrations (timestamp, name)
VALUES (1776378720123, 'InitialSchema1776378720123')
ON CONFLICT DO NOTHING;
SQL
```

---

## 6 · Health verification

```bash
# Readiness — 200 + DB ping
curl -fsS http://localhost:3000/healthz
# Expect: {"status":"ok","db":"up","uptimeSeconds":N}

# Metrics — Prometheus text format
curl -sS http://localhost:3000/metrics | head -20
# Expect: anaqat_process_cpu_seconds_total, ..., anaqat_nodejs_eventloop_lag_seconds

# Contract — OpenAPI UI + JSON
curl -fsS http://localhost:3000/api-docs-json | jq .info.title
# Expect: "Anaqat Al-Iraq Backend API"

# End-to-end smoke — login against the first OWNER
STORE_ID=<uuid>
curl -sS -X POST "http://localhost:3000/api/v1/auth/login?storeId=${STORE_ID}" \
  -H 'content-type: application/json' \
  -d '{"username":"<owner>","password":"<pw>"}'
# Expect: {"access_token":"eyJ...","user":{...}}
```

---

## 7 · Bootstrap the first tenant

After the app is up and migrations are applied, a fresh DB has zero stores and zero users:

```bash
# 1. Create the single allowed bootstrap store (subsequent POST /stores → 403)
STORE_JSON=$(curl -sS -X POST http://localhost:3000/api/v1/stores \
  -H 'content-type: application/json' \
  -d '{"name":"My Store","address":"...","phone":"..."}')
STORE_ID=$(echo "$STORE_JSON" | jq -r .id)

# 2. Bootstrap the first OWNER (subsequent POST /auth/register → 403)
curl -sS -X POST http://localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d "{\"username\":\"owner\",\"password\":\"<strong>\",
       \"fullName\":\"Owner Name\",\"storeId\":\"$STORE_ID\",\"role\":\"OWNER\"}"

# 3. All further users via JWT-authenticated POST /api/v1/users
```

---

## 8 · Common failure modes

| Symptom | Cause | Remediation |
|---|---|---|
| Boot exits 1 with `Config validation error: JWT_SECRET` | env not loaded | check secret manager / `.env` permissions |
| Boot exits 1 with `CORS_ORIGIN must be...` | prod CORS set to `*` | use explicit allow-list |
| `/healthz` → 503 `db: down` | Postgres unreachable | network ACL / DNS / restart DB |
| `/api/v1/...` → 401 on every call | JWT expired or wrong secret | re-login; compare issuer/verifier secret |
| `migration:run` → `relation already exists` | existing DB built with synchronize | apply §5c bootstrap |
| `POST /auth/register` → 403 | store already has users | use `POST /users` with an OWNER JWT |
| `POST /stores` → 403 | first store already created | intentional — bootstrap is one-shot |
| Uploads disappear on redeploy | uploads dir not a volume | mount a persistent volume to `/app/uploads` |
