import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, bootstrapOwner, seedPublishedBook } from '../utils/app';

/**
 * IRPB file 4 §8 — "روابط التنزيل مؤقتة". Verified end-to-end.
 */
describe('signed short-TTL download URLs (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let bookId: string;
  let ownerToken: string;
  let buyerToken: string;
  let orderId: string;

  beforeAll(async () => {
    process.env.DOWNLOAD_URL_TTL_SEC = '60';
    ({ app, ds } = await bootTestApp());
    ({ bookId } = await seedPublishedBook(ds, 'signed-book'));
    await bootstrapOwner(ds, 'signed-owner@example.com');
    ownerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'signed-owner@example.com', password: 'OwnerPassw0rd!' })
        .expect(200)
    ).body.accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Signed Buyer',
        email: 'signed@example.com',
        password: 'SignedPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'signed@example.com'`,
    );
    buyerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'signed@example.com', password: 'SignedPassw0rd!' })
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
      .field('transferReference', 'SGN-1')
      .field('transferAmount', '10.00')
      .field('transferCurrency', 'USD')
      .field('transferDate', '2026-07-17')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('buyer mints a signed link and downloads with it — no JWT header', async () => {
    const http = request(app.getHttpServer());
    const link = await http
      .post(`/api/v1/downloads/order/${orderId}/link`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);
    expect(link.body.url).toContain('/api/v1/downloads/signed?t=');
    expect(link.body.expiresAt).toMatch(/^\d{4}/);

    const dl = await http.get(link.body.url.replace('/api/v1', '/api/v1'))
      .expect(200);
    expect(dl.headers['content-type']).toContain('application/pdf');
    expect(dl.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('signed download rejects a mangled token', async () => {
    const http = request(app.getHttpServer());
    const link = await http
      .post(`/api/v1/downloads/order/${orderId}/link`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);
    const bad = link.body.token.replace(/.$/, 'A');
    await http.get(`/api/v1/downloads/signed?t=${encodeURIComponent(bad)}`).expect(400);
  });

  it('a customer cannot mint a link for another customer\'s order', async () => {
    // register a second buyer
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Not Owner',
        email: 'not-owner@example.com',
        password: 'NotOwnerPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'not-owner@example.com'`,
    );
    const other = (
      await http
        .post('/api/v1/auth/login')
        .send({ email: 'not-owner@example.com', password: 'NotOwnerPassw0rd!' })
        .expect(200)
    ).body.accessToken;

    await http
      .post(`/api/v1/downloads/order/${orderId}/link`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
  });
});
