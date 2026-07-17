import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { bootTestApp, seedPublishedBook, bootstrapOwner } from '../utils/app';
import { SigningService } from '@/modules/fingerprint/signing.service';

describe('purchase flow (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let bookId: string;
  let ownerToken: string;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
    ({ bookId } = await seedPublishedBook(ds, 'e2e-book'));
    await bootstrapOwner(ds);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'OwnerPassw0rd!' })
      .expect(200);
    ownerToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers → verifies → logs in → orders → uploads proof → is fulfilled → downloads → reissues → all signatures verify', async () => {
    const http = request(app.getHttpServer());

    // 1) register
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Buyer',
        email: 'buyer@example.com',
        password: 'BuyerPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);

    // Login should fail before verify
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'buyer@example.com', password: 'BuyerPassw0rd!' })
      .expect(401);

    // Grab the hashed verification token from the DB and verify
    const [tokRow] = await ds.query(
      `SELECT "tokenHash" FROM email_verification_tokens
       WHERE "userId" = (SELECT id FROM users WHERE email='buyer@example.com')`,
    );
    // We don't have the plaintext — reissue by directly consuming via the DB path
    // is not the flow we want to test. Instead, forge a fresh token via the
    // service so we test the actual verify endpoint's logic.
    // We simply verify by updating the DB — the endpoint is exercised in the
    // dedicated auth spec.
    expect(tokRow.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'buyer@example.com'`,
    );

    // 2) login
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'buyer@example.com', password: 'BuyerPassw0rd!' })
      .expect(200);
    const buyerToken: string = login.body.accessToken;
    expect(buyerToken).toBeDefined();

    // 3) create order
    const order = await http
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ bookId, agreementAccepted: true })
      .expect(201);
    const orderId = order.body.id;
    expect(order.body.orderNumber).toMatch(/^QSD-\d{8}-\d{6}$/);

    // 4) upload transfer proof (real PNG bytes so the sniff check passes)
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000000000005000155a3d9f30000000049454e44ae426082',
      'hex',
    );
    await http
      .post(`/api/v1/orders/${orderId}/transfer-proof`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .attach('file', png, { filename: 'proof.png', contentType: 'image/png' })
      .field('transferReference', 'REF-1')
      .field('transferAmount', '10.00')
      .field('transferCurrency', 'USD')
      .field('transferDate', '2026-07-17')
      .expect(201);

    // 5) admin approves — copy is issued
    const approve = await http
      .post(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(approve.body.copyUuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(approve.body.generationNumber).toBe(1);

    // 6) buyer downloads
    const dl = await http
      .get(`/api/v1/downloads/order/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);
    expect(dl.headers['content-type']).toContain('application/pdf');
    expect(dl.headers['content-disposition']).toContain('e2e-book-');

    // 7) reissue keeps the same UUID, produces a NEW generation
    const reissue = await http
      .post(`/api/v1/orders/${orderId}/reissue-copy`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);
    expect(reissue.body.copyUuid).toBe(approve.body.copyUuid);
    expect(reissue.body.generationNumber).toBe(2);
    expect(reissue.body.generationId).not.toBe(approve.body.generationId);

    // 8) forensic JSON report — every generation's signature verifies
    const report = await http
      .get(`/api/v1/admin/lookup/copy/${approve.body.copyUuid}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(report.body.reportNumber).toMatch(/^FR-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/);
    expect(report.body.identity.currentGenerationNumber).toBe(2);
    expect(report.body.generations).toHaveLength(2);
    for (const g of report.body.generations) {
      expect(g.signatureValid).toBe(true);
    }

    // 9) PDF report renders
    const pdf = await http
      .get(`/api/v1/admin/lookup/copy/${approve.body.copyUuid}/report.pdf`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');

    // 10) generated file on disk hashes back to the recorded sha256
    const [gen] = await ds.query(
      `SELECT g."filePath", g."fileSha256"
       FROM issued_copy_generations g
       JOIN issued_copies c ON c.id = g."issuedCopyId"
       WHERE c."copyUuid" = $1 AND g."generationNumber" = 2`,
      [approve.body.copyUuid],
    );
    const bytes = fs.readFileSync(
      path.join(process.env.STORAGE_ROOT!, 'generated', gen.filePath),
    );
    const { createHash } = await import('crypto');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(gen.fileSha256);
  });

  it('rejects a customer trying to download another customer’s order', async () => {
    const http = request(app.getHttpServer());

    // register + verify a second buyer
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Other',
        email: 'other@example.com',
        password: 'OtherPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'other@example.com'`,
    );
    const otherLogin = await http
      .post('/api/v1/auth/login')
      .send({ email: 'other@example.com', password: 'OtherPassw0rd!' })
      .expect(200);
    const otherToken: string = otherLogin.body.accessToken;

    // take the previous buyer's fulfilled order
    const [order] = await ds.query(
      `SELECT id FROM orders WHERE "userId" = (SELECT id FROM users WHERE email='buyer@example.com')
       ORDER BY "createdAt" DESC LIMIT 1`,
    );
    await http
      .get(`/api/v1/downloads/order/${order.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('verifies an issued signature offline via SigningService', async () => {
    const [gen] = await ds.query(
      `SELECT * FROM issued_copy_generations ORDER BY "createdAt" DESC LIMIT 1`,
    );
    const signing = new SigningService();
    (signing as unknown as { load: () => void }).load();
    expect(signing.verify(gen.signedPayload, gen.signature)).toBe(true);

    // Tamper with the payload → signature must fail.
    const tampered = { ...gen.signedPayload, fileSha256: 'c'.repeat(64) };
    expect(signing.verify(tampered, gen.signature)).toBe(false);
  });
});
