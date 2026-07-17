import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, bootstrapOwner, seedPublishedBook } from '../utils/app';

/**
 * Two concurrent approve calls must not double-issue a copy. The IRPB rules
 * (§8 file 2, §7 file 4) say: one order → one UUID; every generation is
 * uniquely numbered. The service uses:
 *   1. UPDATE … WHERE status='awaiting_review' RETURNING — only one caller
 *      wins the atomic transition.
 *   2. uq_generation_per_copy (issuedCopyId, generationNumber) — even if
 *      two workers somehow reach the generation step, the second insert
 *      raises a DB error.
 */
describe('approve idempotency + concurrency (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let bookId: string;
  let ownerToken: string;
  let buyerToken: string;
  let orderId: string;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
    ({ bookId } = await seedPublishedBook(ds, 'idem-book'));
    const owner = await bootstrapOwner(ds, 'owner-idem@example.com');
    ownerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'owner-idem@example.com', password: 'OwnerPassw0rd!', mfaCode: owner.mfaCode() })
        .expect(200)
    ).body.accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Race Tester',
        email: 'race@example.com',
        password: 'RacePassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'race@example.com'`,
    );
    buyerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'race@example.com', password: 'RacePassw0rd!' })
        .expect(200)
    ).body.accessToken;

    orderId = (
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ bookId, agreementAccepted: true })
        .expect(201)
    ).body.id;

    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000000000005000155a3d9f30000000049454e44ae426082',
      'hex',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/transfer-proof`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .attach('file', png, { filename: 'proof.png', contentType: 'image/png' })
      .field('transferReference', 'REF-race')
      .field('transferAmount', '10.00')
      .field('transferCurrency', 'USD')
      .field('transferDate', '2026-07-17')
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('two concurrent approve calls: exactly one succeeds, exactly one generation exists', async () => {
    const http = request(app.getHttpServer());
    const [a, b] = await Promise.allSettled([
      http.post(`/api/v1/admin/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`),
      http.post(`/api/v1/admin/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`),
    ]);
    const statuses = [a, b]
      .filter((r): r is PromiseFulfilledResult<request.Response> => r.status === 'fulfilled')
      .map((r) => r.value.status);
    // One wins (201), one loses (400 — race lost, order is no longer
    // awaiting_review). Either ordering is fine.
    expect(statuses.sort()).toEqual([201, 400]);

    const [gens] = await ds.query(
      `SELECT count(*)::int AS c FROM issued_copy_generations g
       JOIN issued_copies c ON c.id = g."issuedCopyId"
       JOIN orders o ON o.id = c."orderId" WHERE o.id = $1`,
      [orderId],
    );
    expect(gens.c).toBe(1);

    const [orderRow] = await ds.query(
      `SELECT status FROM orders WHERE id = $1`,
      [orderId],
    );
    expect(orderRow.status).toBe('fulfilled');
  });

  it('a third approve call after fulfillment is rejected without side effects', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);

    const [gens] = await ds.query(
      `SELECT count(*)::int AS c FROM issued_copy_generations g
       JOIN issued_copies c ON c.id = g."issuedCopyId"
       JOIN orders o ON o.id = c."orderId" WHERE o.id = $1`,
      [orderId],
    );
    expect(gens.c).toBe(1);
  });

  it('reissue is serialised by pg advisory lock — two concurrent calls produce EXACTLY two new generations, numbered 2 and 3', async () => {
    // Prior tests already produced generation 1 (initial issue).
    const http = request(app.getHttpServer());
    const [a, b] = await Promise.all([
      http.post(`/api/v1/orders/${orderId}/reissue-copy`)
        .set('Authorization', `Bearer ${buyerToken}`),
      http.post(`/api/v1/orders/${orderId}/reissue-copy`)
        .set('Authorization', `Bearer ${buyerToken}`),
    ]);
    // Both must succeed (advisory lock serialises them; neither races).
    expect([a.status, b.status].sort()).toEqual([201, 201]);
    const numbers = [a.body.generationNumber, b.body.generationNumber].sort();
    expect(numbers).toEqual([2, 3]);

    const [gens] = await ds.query(
      `SELECT count(*)::int AS c FROM issued_copy_generations g
       JOIN issued_copies c ON c.id = g."issuedCopyId"
       JOIN orders o ON o.id = c."orderId" WHERE o.id = $1`,
      [orderId],
    );
    // initial (gen 1) + two reissues (gen 2 + gen 3) = exactly 3.
    expect(gens.c).toBe(3);

    const rows = await ds.query(
      `SELECT g."generationNumber", g."generationId", g."fileSha256"
       FROM issued_copy_generations g
       JOIN issued_copies c ON c.id = g."issuedCopyId"
       JOIN orders o ON o.id = c."orderId"
       WHERE o.id = $1 ORDER BY g."generationNumber"`,
      [orderId],
    );
    const seenIds = new Set(rows.map((r: { generationId: string }) => r.generationId));
    // Every generation id is distinct.
    expect(seenIds.size).toBe(3);
    // Every hash is distinct.
    const seenHashes = new Set(rows.map((r: { fileSha256: string }) => r.fileSha256));
    expect(seenHashes.size).toBe(3);
  });
});
