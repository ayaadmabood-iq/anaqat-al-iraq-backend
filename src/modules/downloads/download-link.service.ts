import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { DownloadToken, IssuedCopy } from '@/database';

/**
 * Short-TTL signed download URLs (IRPB file 4 §8).
 *
 * The token payload carries: { orderId, userId, generationId, jti, exp }
 * signed with DOWNLOAD_URL_SECRET (independent of JWT_SECRET in production).
 *
 * Bindings:
 *   • orderId       — a token cannot download a different order
 *   • userId        — a token stolen from user A cannot be used by B's account (soft — the endpoint is anonymous by design; the binding surfaces in the audit log)
 *   • generationId  — a token issued when generation N was current cannot download generation N+1 (mint a new link after admin_reissue)
 *
 * Single-use: consumption inserts the `jti` into `download_tokens`; the
 * PRIMARY KEY on `jti` makes replay a DB error → returned as 410 Gone.
 * Rows are kept for forensic replay analysis; a cron cleans them past 30
 * days.
 *
 * TTL: DOWNLOAD_URL_TTL_SEC — default 300, clamped to [30, 3600].
 */
@Injectable()
export class DownloadLinkService {
  constructor(
    @InjectRepository(DownloadToken)
    private readonly tokens: Repository<DownloadToken>,
    @InjectRepository(IssuedCopy)
    private readonly copies: Repository<IssuedCopy>,
  ) {}

  private secret(): Buffer {
    const isProd = process.env.NODE_ENV === 'production';
    const s = process.env.DOWNLOAD_URL_SECRET;
    if (isProd) {
      if (!s || s.length < 32) {
        throw new Error('DOWNLOAD_URL_SECRET is required in production (≥ 32 chars)');
      }
      return Buffer.from(s, 'utf8');
    }
    const fallback = s || process.env.JWT_SECRET || '';
    if (fallback.length < 16) {
      throw new Error('DOWNLOAD_URL_SECRET / JWT_SECRET missing');
    }
    return Buffer.from(fallback, 'utf8');
  }

  private ttlSec(): number {
    const v = parseInt(process.env.DOWNLOAD_URL_TTL_SEC || '300', 10);
    if (!Number.isFinite(v) || v < 30 || v > 3600) return 300;
    return v;
  }

  async issue(orderId: string, userId: string): Promise<{ url: string; token: string; expiresAt: string }> {
    // Look up the current generation for this order so the token is bound to
    // it. If a later admin reissue changes currentGenerationId, previously
    // minted tokens stop working — the user mints a new one.
    const copy = await this.copies.findOne({ where: { orderId } });
    if (!copy) throw new NotFoundException('copy not found');
    const generationId = copy.currentGenerationId ?? '';
    if (!generationId) throw new NotFoundException('copy generation missing');

    const exp = Math.floor(Date.now() / 1000) + this.ttlSec();
    const jti = randomBytes(16).toString('hex');
    const payload = { o: orderId, u: userId, g: generationId, e: exp, j: jti };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    const token = `${body}.${sig}`;
    return {
      token,
      url: `/api/v1/downloads/signed?t=${encodeURIComponent(token)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  private parseAndVerify(token: string): {
    orderId: string;
    userId: string;
    generationId: string;
    jti: string;
    exp: number;
  } {
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
    const { o, u, g, e, j } = json as {
      o?: string; u?: string; g?: string; e?: number; j?: string;
    };
    if (!o || !u || !g || !j || typeof e !== 'number') {
      throw new BadRequestException('invalid payload');
    }
    if (Math.floor(Date.now() / 1000) > e) {
      throw new BadRequestException('link expired');
    }
    return { orderId: o, userId: u, generationId: g, jti: j, exp: e };
  }

  /**
   * Consumes a signed token — records it in `download_tokens` and returns
   * the resolved fields. Second use of the same jti raises 410 Gone.
   */
  async consume(token: string, ip: string | undefined): Promise<{ orderId: string; userId: string; generationId: string }> {
    const { orderId, userId, generationId, jti, exp } = this.parseAndVerify(token);
    // Confirm the token still matches the copy's current generation.
    const copy = await this.copies.findOne({ where: { orderId } });
    if (!copy) throw new NotFoundException('copy not found');
    if (copy.currentGenerationId !== generationId) {
      throw new BadRequestException(
        'download link is bound to a stale generation — mint a new link',
      );
    }
    try {
      await this.tokens.insert({
        jti,
        orderId,
        userId,
        generationId,
        expiresAt: new Date(exp * 1000),
        consumedAt: new Date(),
        consumedIp: ip ?? null,
      });
    } catch (err) {
      // Unique-violation on jti = replay.
      if ((err as { code?: string }).code === '23505') {
        throw new GoneException('download link already used');
      }
      throw err;
    }
    return { orderId, userId, generationId };
  }
}
