import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SigningPayload {
  copyUuid: string;
  generationId: string;
  generationNumber: number;
  orderNumber: string;
  bookId: string;
  bookEdition: string;
  buyerUserId: string;
  fileSha256: string;
  issuedAt: string;
}

export interface Signature {
  algo: 'HMAC-SHA256';
  keyId: string;
  signedAt: string;
  value: string;
}

interface KeyRing {
  active: string;
  keys: Map<string, Buffer>;
}

/**
 * Detached HMAC-SHA256 signature with a key ring.
 *
 * The service loads N keys and picks ONE as active. Signing always uses the
 * active key and stamps its `keyId` into the signature; verification looks
 * up the key by `signature.keyId`, so old signatures keep verifying after
 * a rotation to a new active key.
 *
 * ── Configuration ──
 *   COPY_SIGNING_KEY            hex ≥ 32 B — a single-key setup (backwards
 *                              compatible; treated as key `k1`).
 *   COPY_SIGNING_KEY_FILE       path to a hex file (same shape).
 *   COPY_SIGNING_KEYS           JSON array of {id, hex} — the ring.
 *   COPY_SIGNING_KEYS_FILE      path to the JSON file (same shape).
 *   COPY_SIGNING_ACTIVE_KEY_ID  which id in the ring is active for signing.
 *                              Defaults to the first entry.
 *   COPY_SIGNING_KEY_ID         active id when the single-key env is used
 *                              (defaults to `k1`).
 *
 * Rotation runbook:
 *   1. Add a new {id: 'k2', hex: <fresh 32 B>} to the ring.
 *   2. Deploy → verifying still uses k1 (nothing changes).
 *   3. Flip COPY_SIGNING_ACTIVE_KEY_ID=k2 → new signatures use k2, old ones
 *      still verify with k1.
 *   4. When every generation signed with k1 is safely archived, remove k1
 *      from the ring.
 */
@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private ring: KeyRing | null = null;

  onModuleInit() {
    this.load();
  }

  private storageRoot() {
    return process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
  }
  private devKeyPath() {
    return path.join(this.storageRoot(), 'keys', 'copy-signing.key');
  }

  private parseHex(hex: string, label: string): Buffer {
    const clean = hex.trim();
    if (!/^[0-9a-f]+$/i.test(clean) || clean.length < 64) {
      throw new Error(`${label} must be hex, ≥ 64 characters (32 bytes)`);
    }
    return Buffer.from(clean, 'hex');
  }

  load(env: NodeJS.ProcessEnv = process.env): void {
    const isProd = env.NODE_ENV === 'production';
    const keys = new Map<string, Buffer>();
    let active: string | undefined;

    if (env.COPY_SIGNING_KEYS_FILE) {
      const raw = fs.readFileSync(env.COPY_SIGNING_KEYS_FILE, 'utf8');
      this.parseKeyList(raw, keys);
      active = env.COPY_SIGNING_ACTIVE_KEY_ID || keys.keys().next().value;
    } else if (env.COPY_SIGNING_KEYS) {
      this.parseKeyList(env.COPY_SIGNING_KEYS, keys);
      active = env.COPY_SIGNING_ACTIVE_KEY_ID || keys.keys().next().value;
    } else if (env.COPY_SIGNING_KEY_FILE) {
      const hex = fs.readFileSync(env.COPY_SIGNING_KEY_FILE, 'utf8');
      active = env.COPY_SIGNING_KEY_ID || 'k1';
      keys.set(active, this.parseHex(hex, 'COPY_SIGNING_KEY_FILE'));
    } else if (env.COPY_SIGNING_KEY) {
      active = env.COPY_SIGNING_KEY_ID || 'k1';
      keys.set(active, this.parseHex(env.COPY_SIGNING_KEY, 'COPY_SIGNING_KEY'));
    } else if (!isProd) {
      const p = this.devKeyPath();
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, randomBytes(32).toString('hex'), { mode: 0o600 });
        this.logger.warn(`generated dev-only copy signing key at ${p}. DO NOT reuse in production.`);
      }
      active = 'k1';
      keys.set(active, this.parseHex(fs.readFileSync(p, 'utf8'), 'dev key'));
    } else {
      throw new Error(
        'COPY_SIGNING_KEY / COPY_SIGNING_KEY_FILE / COPY_SIGNING_KEYS[_FILE] must be set in production',
      );
    }

    if (!active || !keys.has(active)) {
      throw new Error(`COPY_SIGNING_ACTIVE_KEY_ID '${active}' is not in the key ring`);
    }
    this.ring = { active, keys };
    this.logger.log(
      `copy signing ring loaded (active=${active}, keys=[${Array.from(keys.keys()).join(',')}])`,
    );
  }

  private parseKeyList(json: string, into: Map<string, Buffer>): void {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('COPY_SIGNING_KEYS must be a non-empty JSON array');
    }
    for (const entry of arr) {
      if (!entry?.id || !entry?.hex) {
        throw new Error('COPY_SIGNING_KEYS entries need { id, hex }');
      }
      into.set(String(entry.id), this.parseHex(String(entry.hex), `key ${entry.id}`));
    }
  }

  static canonical(payload: SigningPayload): string {
    const ordered = {
      bookEdition: payload.bookEdition,
      bookId: payload.bookId,
      buyerUserId: payload.buyerUserId,
      copyUuid: payload.copyUuid,
      fileSha256: payload.fileSha256,
      generationId: payload.generationId,
      generationNumber: payload.generationNumber,
      issuedAt: payload.issuedAt,
      orderNumber: payload.orderNumber,
    };
    return JSON.stringify(ordered);
  }

  /** Returns the currently-active key id — useful for tests and audits. */
  activeKeyId(): string {
    if (!this.ring) throw new Error('signing key ring not loaded');
    return this.ring.active;
  }

  /** Returns every key id present in the ring — for /admin/health surfaces. */
  keyIds(): string[] {
    if (!this.ring) throw new Error('signing key ring not loaded');
    return Array.from(this.ring.keys.keys());
  }

  sign(payload: SigningPayload): Signature {
    if (!this.ring) throw new Error('signing key ring not loaded');
    const key = this.ring.keys.get(this.ring.active);
    if (!key) throw new Error(`active key ${this.ring.active} missing from ring`);
    const mac = createHmac('sha256', key)
      .update(SigningService.canonical(payload))
      .digest('base64');
    return {
      algo: 'HMAC-SHA256',
      keyId: this.ring.active,
      signedAt: new Date().toISOString(),
      value: mac,
    };
  }

  verify(payload: SigningPayload, sig: Signature): boolean {
    if (!this.ring) throw new Error('signing key ring not loaded');
    if (sig.algo !== 'HMAC-SHA256') return false;
    const key = this.ring.keys.get(sig.keyId);
    if (!key) return false;
    const expected = createHmac('sha256', key)
      .update(SigningService.canonical(payload))
      .digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(sig.value, 'base64');
    } catch {
      return false;
    }
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
