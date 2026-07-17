import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
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
  issuedAt: string; // ISO
}

export interface Signature {
  algo: 'HMAC-SHA256';
  keyId: string;
  signedAt: string;
  value: string; // base64 of HMAC(canonical JSON of payload)
}

/**
 * Detached HMAC-SHA256 signature over the fingerprint payload.
 *
 * ── Key material ──
 *   Loaded once at boot from (in order of precedence):
 *     1. COPY_SIGNING_KEY_FILE  — path to a file containing the raw hex key
 *     2. COPY_SIGNING_KEY        — hex key directly in the env
 *     3. STORAGE_ROOT/keys/copy-signing.key (auto-created in development only)
 *   The key is at least 32 bytes. In production the process refuses to boot
 *   with a dev-generated key.
 *
 * ── Why HMAC and not asymmetric signatures ──
 *   MVP verification is done by the owner using a shared secret. When the
 *   verifier is handed over to third parties (auditors, courts) we can rotate
 *   to Ed25519 by adding a second Signature entry with `algo='ED25519'` and
 *   deploying the public key alongside `bin/verify-copy.js`. The schema and
 *   the verifier CLI already accept multiple algorithms.
 */
@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private keyBuf: Buffer | null = null;
  private keyId = 'unknown';

  onModuleInit() {
    this.load();
  }

  private storageRoot() {
    return process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
  }

  private devKeyPath() {
    return path.join(this.storageRoot(), 'keys', 'copy-signing.key');
  }

  private load() {
    const isProd = process.env.NODE_ENV === 'production';
    let hex: string | null = null;
    let source = 'env';

    if (process.env.COPY_SIGNING_KEY_FILE) {
      hex = fs.readFileSync(process.env.COPY_SIGNING_KEY_FILE, 'utf8').trim();
      source = `file:${process.env.COPY_SIGNING_KEY_FILE}`;
    } else if (process.env.COPY_SIGNING_KEY) {
      hex = process.env.COPY_SIGNING_KEY.trim();
    } else if (!isProd) {
      const p = this.devKeyPath();
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const { randomBytes } = require('crypto');
        fs.writeFileSync(p, randomBytes(32).toString('hex'), { mode: 0o600 });
        this.logger.warn(
          `generated dev-only copy signing key at ${p}. DO NOT reuse in production.`,
        );
      }
      hex = fs.readFileSync(p, 'utf8').trim();
      source = `dev-file:${p}`;
    } else {
      throw new Error(
        'COPY_SIGNING_KEY (or COPY_SIGNING_KEY_FILE) must be set in production',
      );
    }

    const buf = Buffer.from(hex, 'hex');
    if (buf.length < 32) {
      throw new Error(
        `COPY_SIGNING_KEY too short: ${buf.length} bytes (need ≥ 32)`,
      );
    }
    this.keyBuf = buf;
    this.keyId = process.env.COPY_SIGNING_KEY_ID || 'k1';
    this.logger.log(
      `copy signing key loaded (id=${this.keyId}, len=${buf.length}, source=${source})`,
    );
  }

  /**
   * Canonical JSON: sort keys deterministically so the signature is stable
   * across languages/serializers.
   */
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

  sign(payload: SigningPayload): Signature {
    if (!this.keyBuf) throw new Error('signing key not loaded');
    const mac = createHmac('sha256', this.keyBuf)
      .update(SigningService.canonical(payload))
      .digest('base64');
    return {
      algo: 'HMAC-SHA256',
      keyId: this.keyId,
      signedAt: new Date().toISOString(),
      value: mac,
    };
  }

  verify(payload: SigningPayload, sig: Signature): boolean {
    if (!this.keyBuf) throw new Error('signing key not loaded');
    if (sig.algo !== 'HMAC-SHA256') return false;
    if (sig.keyId !== this.keyId) return false;
    const expected = createHmac('sha256', this.keyBuf)
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
