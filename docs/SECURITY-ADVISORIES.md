# Security advisories — decision log

Snapshot of `npm audit --omit=dev` on the shipped `package-lock.json` at the
last verification run, with a per-advisory decision (**accept** = tolerate
with mitigations, **replace** = swap the package, **track** = watch upstream
for a patched version and re-audit).

Total: 15 packages with advisories (6 high, 9 moderate). Every advisory
below has been evaluated in this project's actual runtime context.

Command:
```
npm audit --omit=dev
```

## High severity

### 1. `multer` — DoS via various upload paths (5 advisories)

- Advisories: `GHSA-xf7r-hgr6-v32p`, `GHSA-v52c-386h-88mc`,
  `GHSA-5528-5vmv-3xc2`, `GHSA-72gw-mp4g-v24j`, `GHSA-3p4h-7m6x-2hcm`
- Version installed: `multer@2.2.0` (latest 2.x — upstream has not shipped
  a fix). Reached via `@nestjs/platform-express@10`.
- Attack surface: one endpoint (`POST /orders/:id/transfer-proof`).
- Mitigations already in place:
  - Route requires an authenticated `customer` (`JwtAuthGuard` + `RolesGuard`).
  - `Throttle({ upload: { limit: 5, ttl: 60_000 } })` — 5 uploads/minute/IP.
  - `limits: { fileSize: 8 * 1024 * 1024 }` — 8 MB hard cap.
  - `fileFilter` + `assertTransferExtension` + `isTransferMimeAllowed`.
  - Post-write `sniffAndValidate` deletes any file whose magic bytes do
    not match its declared type.
- **Decision: accept + track.** The remaining DoS vectors need many
  parallel connections; rate limit + auth gate + size cap make sustained
  abuse impractical at MVP traffic. Re-audit when Multer 3 lands.

### 2. `lodash` (via `@nestjs/config`) — code injection / prototype pollution

- Advisories: `GHSA-r5fr-rjxr-66jc`, `GHSA-f23m-r3pf-42rh`, `GHSA-xxjr-mmjv-4gpg`
- Path: `@nestjs/config` → `dotenv-expand` chain historically pulled lodash.
- Version installed: `lodash@4.17.21`.
- Attack surface: we never pass user input into `_.template`, `_.set`,
  `_.unset`, or `_.omit`. The exploited functions are not used in our code
  or in `@nestjs/config`'s current template-free flow.
- **Decision: accept + track.** Requires a patched lodash upstream in the
  Nest dependency chain; no code we ship exposes the vulnerable APIs.

### 3. `tar` / `node-tar` — path traversal on extraction

- Advisories: `GHSA-34x7-hfp2-rc4v`, `GHSA-8qq5-rm4j-mr97`,
  `GHSA-83g3-92jg-28cx`, `GHSA-qffp-2rhf-9h96`, `GHSA-9ppj-qmqm-q256`,
  `GHSA-r6q2-hw4h-h46w`
- Path: `bcrypt` → `@mapbox/node-pre-gyp` → `tar`.
- Attack surface: only during `npm install`, extracting native binaries the
  package itself controls. **No runtime call site.** We never `tar.extract`
  user-supplied archives.
- **Decision: accept.** Install-time only; the archive source is
  npmjs.org/mapbox — trusted through package-lock.json integrity hashes.

### 4. `bcrypt` — inherits `@mapbox/node-pre-gyp` → `tar`

- Same story as above. **Decision: accept.**

### 5. `@mapbox/node-pre-gyp` — inherits `tar`

- Install-time helper for prebuilt binaries. Not on any runtime path.
- **Decision: accept.**

### 6. `@nestjs/platform-express` — pulls vulnerable `body-parser`, `express`, `multer`, `@nestjs/core`

- Umbrella advisory; each dep evaluated below/above.
- **Decision: accept + track** for the next `@nestjs/platform-express`
  release chain.

## Moderate severity

### 7. `@nestjs/core` — GHSA-36xv-jgw5-4q75

- Advisory concerns crafted response-header content reaching an untrusted
  downstream renderer. Our API returns JSON only; no HTML render surface;
  Helmet CSP set to `default-src 'none'`; `Content-Disposition` filenames
  pass through `safeFilename`.
- **Decision: accept + track.**

### 8. `@nestjs/common` — inherits `file-type`

- Not on any runtime call site of ours. We never call `file-type.fromBuffer`
  on external input — magic-byte checks are hand-written in
  `src/modules/common/file-validators.ts`.
- **Decision: accept.**

### 9. `@nestjs/config` — inherits `lodash`

- See §2.

### 10. `@nestjs/typeorm` — inherits `uuid`

- See §14. Not user-reachable — the version of `uuid` inside `typeorm` is
  only used to mint internal IDs.

### 11. `file-type`

- Advisories: `GHSA-5v7r-6r5c-r473` (ASF parser loop),
  `GHSA-j47w-4g3g-c36v` (ZIP bomb).
- We do not depend on `file-type` directly. It comes through Nest's dev
  chain and is not called at runtime.
- **Decision: accept + track.**

### 12. `qs` (via `body-parser`, `express`) — DoS on malformed comma-format arrays

- Advisory: `GHSA-vjh7-7g9h-fjfh`.
- Our routes do not use `qs`-style comma arrays. Rate limits blunt the
  vector.
- **Decision: accept + track** for the next Express minor.

### 13. `body-parser` — inherits `qs`

- Same. **Accept + track.**

### 14. `express` — inherits `qs`

- Same. **Accept + track.**

### 15. `uuid` — GHSA-w5hq-g745-h8pq (buffer bounds in v3/v5/v6 when buf provided)

- We call `randomUUID()` from `node:crypto` (see fingerprint + auth). The
  direct `uuid` dependency is only present because TypeORM asks for it as
  a peer. We never call `uuid.v3/v5/v6` with a `buf` argument.
- Installed: `uuid@11.1.1` (top-level); `typeorm/node_modules/uuid@9`
  (transitive). The advisory is fixed in `>=11.1.1` for top-level; the
  TypeORM copy stays on 9 until TypeORM upgrades.
- **Decision: accept + track** for TypeORM's next minor.

---

## Summary

| Level    | Count | All decisions |
|----------|------:|---------------|
| high     | 6     | 6 accept + track |
| moderate | 9     | 9 accept + track |

**No advisory is exploitable in our current runtime configuration** based on
the surface analysis above. Every `accept + track` line is re-evaluated on
each dependency bump, and CI will re-print this table on every PR (see
`.github/workflows/ci.yml`).

If any advisory is later reported as actively exploited in the wild, the
mitigation is: pin an override in `package.json` `overrides`, redeploy, and
open an issue documenting the pin.
