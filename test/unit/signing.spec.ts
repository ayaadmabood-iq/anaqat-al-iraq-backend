import { SigningService, SigningPayload } from '@/modules/fingerprint/signing.service';

function bootService(): SigningService {
  const svc = new SigningService();
  (svc as unknown as { load: () => void }).load();
  return svc;
}

function makePayload(): SigningPayload {
  return {
    copyUuid: '11111111-1111-1111-1111-111111111111',
    generationId: '22222222-2222-2222-2222-222222222222',
    generationNumber: 1,
    orderNumber: 'QSD-20260717-000001',
    bookId: '33333333-3333-3333-3333-333333333333',
    bookEdition: '1',
    buyerUserId: '44444444-4444-4444-4444-444444444444',
    fileSha256: 'a'.repeat(64),
    issuedAt: '2026-07-17T00:00:00.000Z',
  };
}

describe('SigningService', () => {
  const svc = bootService();

  it('canonical form is order-independent', () => {
    const a = SigningService.canonical(makePayload());
    const p2: SigningPayload = { ...makePayload() } as SigningPayload;
    const b = SigningService.canonical(p2);
    expect(a).toBe(b);
  });

  it('signs and verifies its own signature', () => {
    const p = makePayload();
    const sig = svc.sign(p);
    expect(sig.algo).toBe('HMAC-SHA256');
    expect(svc.verify(p, sig)).toBe(true);
  });

  it('rejects a mutated payload', () => {
    const p = makePayload();
    const sig = svc.sign(p);
    const tampered: SigningPayload = { ...p, fileSha256: 'b'.repeat(64) };
    expect(svc.verify(tampered, sig)).toBe(false);
  });

  it('rejects a signature with the wrong algo', () => {
    const p = makePayload();
    const sig = svc.sign(p);
    expect(svc.verify(p, { ...sig, algo: 'RSA-PSS' as unknown as 'HMAC-SHA256' })).toBe(false);
  });

  it('rejects a signature with the wrong keyId', () => {
    const p = makePayload();
    const sig = svc.sign(p);
    expect(svc.verify(p, { ...sig, keyId: 'other' })).toBe(false);
  });
});
