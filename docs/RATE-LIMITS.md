# Rate limits

Three tiers backed by `@nestjs/throttler`. When `REDIS_URL` is set, counters
are shared across nodes via `@nest-lab/throttler-storage-redis`; otherwise
they live in the process (dev only — a warning is logged at boot).

| Tier      | Window | Global cap | Applies to                                    |
|-----------|--------|-----------:|-----------------------------------------------|
| `default` | 60 s   | 120        | Everything not overridden                     |
| `auth`    | 60 s   | 20         | Auth endpoints (base cap)                     |
| `upload`  | 60 s   | 10         | Multipart uploads                             |

## Per-endpoint overrides

| Endpoint                              | Tier    | Limit / window |
|---------------------------------------|---------|----------------|
| `POST /auth/register`                 | auth    | 5 / 60 s       |
| `POST /auth/login`                    | auth    | 10 / 60 s      |
| `POST /auth/forgot-password`          | auth    | 3 / 60 s       |
| `POST /auth/reset-password`           | auth    | 5 / 60 s       |
| `POST /orders/:id/transfer-proof`     | upload  | 5 / 60 s       |

Counters are keyed by client IP (as reported through the proxy — make sure
your Nginx sets `X-Forwarded-For` and Node trusts the proxy).

## Production checklist

- `REDIS_URL=redis://…` set in `.env` (or the platform's secret manager).
- Redis reachable from every API node.
- Firewall closes 6379 to the world; TLS via `rediss://` if the network path
  is untrusted.
- `helmet` CSP: `default-src 'none'; frame-ancestors 'none'; base-uri 'none';
  form-action 'none'` — the API returns JSON, no browser needs to render it.
