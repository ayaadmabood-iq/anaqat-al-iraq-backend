import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-TTL signed download URLs (IRPB file 4 §8: "روابط التنزيل مؤقتة").
 *
 * The token is an opaque base64url string containing:
 *   { orderId, userId, exp, nonce }
 * with an appended HMAC-SHA256 signature using DOWNLOAD_URL_SECRET (falls
 * back to JWT_SECRET). It carries its own expiry so nothing needs to be
 * stored server-side, and it is bound to a single (order, user) pair so a
 * captured link cannot be used to download someone else's file.
 *
 * Verifying the token is timing-safe. Tokens are single-URL-shot in intent
 * (short TTL) but not single-use — replay within the TTL is possible and
 * is by design: the buyer's own client may retry the download.
 */
@Injectable()
export class DownloadLinkService {
  private secret(): Buffer {
    const s =
      process.env.DOWNLOAD_URL_SECRET ||
      process.env.JWT_SECRET ||
      '';
    if (s.length < 16) {
      // In production this is prevented by the boot guard; still refuse to
      // hand out an unsigned link at runtime.
      throw new Error('DOWNLOAD_URL_SECRET / JWT_SECRET missing');
    }
    return Buffer.from(s, 'utf8');
  }

  private ttlSec(): number {
    const v = parseInt(process.env.DOWNLOAD_URL_TTL_SEC || '300', 10);
    if (!Number.isFinite(v) || v < 30 || v > 3600) return 300;
    return v;
  }

  issue(orderId: string, userId: string): { url: string; token: string; expiresAt: string } {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSec();
    const nonce = Math.random().toString(36).slice(2, 12);
    const payload = { o: orderId, u: userId, e: exp, n: nonce };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    const token = `${body}.${sig}`;
    return {
      token,
      url: `/api/v1/downloads/signed?t=${encodeURIComponent(token)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  verify(token: string): { orderId: string; userId: string } {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      throw new BadRequestException('invalid token');
    }
    const [body, providedB64] = token.split('.');
    const expected = createHmac('sha256', this.secret()).update(body).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(providedB64, 'base64url');
    } catch {
      throw new BadRequestException('invalid token');
    }
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new BadRequestException('invalid signature');
    }
    let json: unknown;
    try {
      json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('invalid payload');
    }
    const { o, u, e } = json as { o?: string; u?: string; e?: number };
    if (!o || !u || typeof e !== 'number') {
      throw new BadRequestException('invalid payload');
    }
    if (Math.floor(Date.now() / 1000) > e) {
      throw new BadRequestException('link expired');
    }
    return { orderId: o, userId: u };
  }
}
