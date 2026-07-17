import { SigningService, SigningPayload } from '@/modules/fingerprint/signing.service';

function loadWith(env: NodeJS.ProcessEnv): SigningService {
  const svc = new SigningService();
  svc.load(env);
  return svc;
}

function payload(): SigningPayload {
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

describe('SigningService key ring', () => {
  const K1 = 'a'.repeat(64);
  const K2 = 'b'.repeat(64);

  it('single-key env loads as ring with active=k1', () => {
    const svc = loadWith({ COPY_SIGNING_KEY: K1, NODE_ENV: 'test' });
    expect(svc.activeKeyId()).toBe('k1');
    expect(svc.keyIds()).toEqual(['k1']);
  });

  it('signs with the active key and stamps its id', () => {
    const svc = loadWith({ COPY_SIGNING_KEY: K1, NODE_ENV: 'test' });
    const sig = svc.sign(payload());
    expect(sig.keyId).toBe('k1');
    expect(svc.verify(payload(), sig)).toBe(true);
  });

  it('rotation: after switching active from k1 to k2, old k1 sigs still verify', () => {
    // Sign with a ring where k1 is active.
    const before = loadWith({
      COPY_SIGNING_KEYS: JSON.stringify([
        { id: 'k1', hex: K1 },
        { id: 'k2', hex: K2 },
      ]),
      COPY_SIGNING_ACTIVE_KEY_ID: 'k1',
      NODE_ENV: 'test',
    });
    const oldSig = before.sign(payload());
    expect(oldSig.keyId).toBe('k1');

    // Deploy the rotation: same ring, active flipped to k2.
    const after = loadWith({
      COPY_SIGNING_KEYS: JSON.stringify([
        { id: 'k1', hex: K1 },
        { id: 'k2', hex: K2 },
      ]),
      COPY_SIGNING_ACTIVE_KEY_ID: 'k2',
      NODE_ENV: 'test',
    });
    expect(after.activeKeyId()).toBe('k2');

    // The old signature (keyId=k1) must still verify.
    expect(after.verify(payload(), oldSig)).toBe(true);

    // A fresh signature uses k2 and also verifies.
    const newSig = after.sign(payload());
    expect(newSig.keyId).toBe('k2');
    expect(after.verify(payload(), newSig)).toBe(true);
  });

  it('after k1 is retired from the ring, k1-signed signatures no longer verify', () => {
    const withBoth = loadWith({
      COPY_SIGNING_KEYS: JSON.stringify([
        { id: 'k1', hex: K1 },
        { id: 'k2', hex: K2 },
      ]),
      COPY_SIGNING_ACTIVE_KEY_ID: 'k1',
      NODE_ENV: 'test',
    });
    const k1Sig = withBoth.sign(payload());

    const withoutK1 = loadWith({
      COPY_SIGNING_KEYS: JSON.stringify([{ id: 'k2', hex: K2 }]),
      COPY_SIGNING_ACTIVE_KEY_ID: 'k2',
      NODE_ENV: 'test',
    });
    expect(withoutK1.verify(payload(), k1Sig)).toBe(false);
  });

  it('refuses to activate an id that is not in the ring', () => {
    expect(() =>
      loadWith({
        COPY_SIGNING_KEYS: JSON.stringify([{ id: 'k1', hex: K1 }]),
        COPY_SIGNING_ACTIVE_KEY_ID: 'k9',
        NODE_ENV: 'test',
      }),
    ).toThrow(/not in the key ring/);
  });

  it('refuses short/non-hex keys', () => {
    expect(() =>
      loadWith({ COPY_SIGNING_KEY: 'ab'.repeat(10), NODE_ENV: 'test' }),
    ).toThrow(/≥ 64/);
    expect(() => loadWith({ COPY_SIGNING_KEY: 'not-hex', NODE_ENV: 'test' })).toThrow();
  });
});
