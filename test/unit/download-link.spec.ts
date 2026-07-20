import { DownloadLinkService } from '@/modules/downloads/download-link.service';
import type { DownloadToken, IssuedCopy } from '@/database';
import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

/**
 * Verifies the token layer end-to-end without a DB: repository stubs
 * simulate an issued copy with a currentGenerationId and a `download_tokens`
 * table that raises unique-violation on replay.
 */
describe('DownloadLinkService', () => {
  const withEnv = <T>(vars: NodeJS.ProcessEnv, fn: () => Promise<T> | T): Promise<T> | T => {
    const backup: NodeJS.ProcessEnv = {};
    for (const k of Object.keys(vars)) backup[k] = process.env[k];
    Object.assign(process.env, vars);
    const finish = () => {
      for (const k of Object.keys(vars)) {
        if (backup[k] === undefined) delete process.env[k];
        else process.env[k] = backup[k];
      }
    };
    const result = fn();
    if (result instanceof Promise) return result.finally(finish);
    finish();
    return result;
  };

  function build(overrides: {
    copy?: Partial<IssuedCopy> | null;
    onInsertJti?: (jti: string) => void;
  } = {}): DownloadLinkService {
    const stored = new Set<string>();
    const copies = {
      findOne: async () => (overrides.copy === null ? null : { currentGenerationId: 'gen-1', ...(overrides.copy || {}) }),
    } as unknown as Repository<IssuedCopy>;
    const tokens = {
      insert: async (row: { jti: string }) => {
        overrides.onInsertJti?.(row.jti);
        if (stored.has(row.jti)) {
          const err = new Error('duplicate') as Error & { code: string };
          err.code = '23505';
          throw err;
        }
        stored.add(row.jti);
        return { identifiers: [] };
      },
    } as unknown as Repository<DownloadToken>;
    return new DownloadLinkService(tokens, copies);
  }

  it('issues then consumes a token bound to (order, user, generation)', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48), DOWNLOAD_URL_TTL_SEC: '300' }, async () => {
      const svc = build();
      const link = await svc.issue('order-1', 'user-1');
      expect(link.url).toContain('/api/v1/downloads/signed?t=');
      const back = await svc.consume(link.token, '127.0.0.1');
      expect(back).toEqual({ orderId: 'order-1', userId: 'user-1', generationId: 'gen-1' });
    });
  });

  it('single-use — replay of the same token returns 410 Gone', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, async () => {
      const svc = build();
      const link = await svc.issue('order-1', 'user-1');
      await svc.consume(link.token, '1.1.1.1');
      await expect(svc.consume(link.token, '1.1.1.1')).rejects.toBeInstanceOf(GoneException);
    });
  });

  it('a token issued while gen-1 was current is rejected after admin rotated to gen-2', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, async () => {
      const svcAtIssue = build({ copy: { currentGenerationId: 'gen-1' } });
      const link = await svcAtIssue.issue('order-1', 'user-1');

      const svcAfterRotate = build({ copy: { currentGenerationId: 'gen-2' } });
      await expect(svcAfterRotate.consume(link.token, '1.1.1.1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('rejects a tampered signature', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, async () => {
      const svc = build();
      const link = await svc.issue('order-1', 'user-1');
      const [body, sig] = link.token.split('.');
      // Tamper the FIRST sig char, not the last: an HMAC-SHA256 signature
      // encodes to 43 base64url chars, where the LAST char carries only 4
      // data bits + 2 base64 padding bits — so 4 different last-chars all
      // decode to the same signature bytes and the "tamper" is a no-op.
      // Middle/first chars use all 6 bits, so any flip is a real change.
      const flipped = sig[0] === 'A' ? 'B' : 'A';
      const bad = `${body}.${flipped}${sig.slice(1)}`;
      await expect(svc.consume(bad, '1.1.1.1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('rejects expired tokens', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48), DOWNLOAD_URL_TTL_SEC: '30' }, async () => {
      const svc = build();
      const link = await svc.issue('order-1', 'user-1');
      const realNow = Date.now;
      Date.now = () => realNow() + 3600 * 1000;
      try {
        await expect(svc.consume(link.token, '1.1.1.1')).rejects.toThrow(/expired/);
      } finally {
        Date.now = realNow;
      }
    });
  });

  it('rejects when the referenced copy does not exist', async () => {
    await withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, async () => {
      const svcIssuer = build();
      const link = await svcIssuer.issue('order-x', 'user-x');
      const svcNoCopy = build({ copy: null });
      await expect(svcNoCopy.consume(link.token, '1.1.1.1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('refuses to mint in production without DOWNLOAD_URL_SECRET', async () => {
    await withEnv({ NODE_ENV: 'production', DOWNLOAD_URL_SECRET: undefined as unknown as string, JWT_SECRET: 'x'.repeat(48) }, async () => {
      const svc = build();
      await expect(svc.issue('order-1', 'user-1')).rejects.toThrow(/DOWNLOAD_URL_SECRET/);
    });
  });
});
