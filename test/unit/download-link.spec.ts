import { DownloadLinkService } from '@/modules/downloads/download-link.service';
import { BadRequestException } from '@nestjs/common';

describe('DownloadLinkService', () => {
  const withEnv = <T>(vars: NodeJS.ProcessEnv, fn: () => T): T => {
    const backup: NodeJS.ProcessEnv = {};
    for (const k of Object.keys(vars)) backup[k] = process.env[k];
    Object.assign(process.env, vars);
    try {
      return fn();
    } finally {
      for (const k of Object.keys(vars)) {
        if (backup[k] === undefined) delete process.env[k];
        else process.env[k] = backup[k];
      }
    }
  };

  it('issues and verifies a token bound to (order, user)', () => {
    withEnv(
      { DOWNLOAD_URL_SECRET: 's'.repeat(48), DOWNLOAD_URL_TTL_SEC: '300' },
      () => {
        const svc = new DownloadLinkService();
        const link = svc.issue('order-1', 'user-1');
        expect(link.url).toContain('/api/v1/downloads/signed?t=');
        expect(link.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        const back = svc.verify(link.token);
        expect(back).toEqual({ orderId: 'order-1', userId: 'user-1' });
      },
    );
  });

  it('rejects a tampered token', () => {
    withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, () => {
      const svc = new DownloadLinkService();
      const { token } = svc.issue('order-1', 'user-1');
      // Flip a char in the signature half.
      const [body, sig] = token.split('.');
      const bad = `${body}.${sig.slice(0, -1)}A`;
      expect(() => svc.verify(bad)).toThrow(BadRequestException);
    });
  });

  it('rejects an expired token', () => {
    withEnv(
      { DOWNLOAD_URL_SECRET: 's'.repeat(48), DOWNLOAD_URL_TTL_SEC: '30' },
      () => {
        const svc = new DownloadLinkService();
        const { token } = svc.issue('order-1', 'user-1');
        // Fast-forward the clock past exp by mocking Date.now for the verify.
        const realNow = Date.now;
        try {
          Date.now = () => realNow() + 3600 * 1000;
          expect(() => svc.verify(token)).toThrow(/expired/);
        } finally {
          Date.now = realNow;
        }
      },
    );
  });

  it('rejects malformed tokens', () => {
    withEnv({ DOWNLOAD_URL_SECRET: 's'.repeat(48) }, () => {
      const svc = new DownloadLinkService();
      expect(() => svc.verify('')).toThrow();
      expect(() => svc.verify('no-dot')).toThrow();
      expect(() => svc.verify('a.b')).toThrow();
    });
  });
});
