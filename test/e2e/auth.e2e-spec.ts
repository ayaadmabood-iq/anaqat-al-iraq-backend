import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHash } from 'crypto';
import { bootTestApp } from '../utils/app';

async function extractPlainToken(
  ds: DataSource,
  userId: string,
  table: 'email_verification_tokens' | 'password_reset_tokens',
): Promise<string> {
  // The plaintext token is not stored — we invert that by iterating the
  // captured mail-log lines. Since our test mailer writes to Nest's logger, we
  // reconstruct via the outgoing side channel: re-issue and grab the token
  // out of the returned URL. For E2E purposes we shortcut by generating one
  // ourselves and inserting it.
  const [row] = await ds.query(
    `SELECT id, "tokenHash" FROM ${table} WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  expect(row).toBeTruthy();
  // Overwrite with a known-plaintext token so the test can hit the endpoint
  // with a real value. In production callers would use the emailed link.
  const plain = 'test-token-' + row.id.replace(/-/g, '');
  const hash = createHash('sha256').update(plain, 'utf8').digest('hex');
  await ds.query(`UPDATE ${table} SET "tokenHash" = $1 WHERE id = $2`, [hash, row.id]);
  return plain;
}

describe('auth flows (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → verify email → login → change password invalidates old JWTs', async () => {
    const http = request(app.getHttpServer());

    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Alice',
        email: 'alice@example.com',
        password: 'AlicePassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);

    const [user] = await ds.query(
      `SELECT id FROM users WHERE email = 'alice@example.com'`,
    );

    const verifyToken = await extractPlainToken(
      ds,
      user.id,
      'email_verification_tokens',
    );
    await http.get(`/api/v1/auth/verify?token=${verifyToken}`).expect(200);

    // second use of the same token fails
    await http.get(`/api/v1/auth/verify?token=${verifyToken}`).expect(400);

    const login1 = await http
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'AlicePassw0rd!' })
      .expect(200);
    const token1 = login1.body.accessToken;

    // /auth/me works
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    // change password
    await http
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        currentPassword: 'AlicePassw0rd!',
        newPassword: 'AliceNewPassw0rd!',
      })
      .expect(200);

    // old token is rejected
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .expect(401);

    // new login works
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'AliceNewPassw0rd!' })
      .expect(200);
  });

  it('forgot-password issues a single-use, time-limited token that invalidates sessions', async () => {
    const http = request(app.getHttpServer());

    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Bob',
        email: 'bob@example.com',
        password: 'BobPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'bob@example.com'`,
    );
    const [user] = await ds.query(
      `SELECT id FROM users WHERE email = 'bob@example.com'`,
    );

    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'BobPassw0rd!' })
      .expect(200);
    const oldToken = login.body.accessToken;

    // forgot-password ALWAYS returns ok, even for unknown addresses.
    await http
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'no-such@example.com' })
      .expect(200);
    await http
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'bob@example.com' })
      .expect(200);

    const resetToken = await extractPlainToken(
      ds,
      user.id,
      'password_reset_tokens',
    );

    await http
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'BobFreshPassw0rd!' })
      .expect(200);

    // the token is single-use
    await http
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, newPassword: 'BobFreshPassw0rd!' })
      .expect(400);

    // The old JWT no longer works.
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    // The new password works.
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'BobFreshPassw0rd!' })
      .expect(200);
  });

  it('rejects registration without consent', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Carol',
        email: 'carol@example.com',
        password: 'CarolPassw0rd!',
        privacyAccepted: false,
        termsAccepted: true,
      })
      .expect(400);
  });

  it('rejects an expired verification token', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Dan',
        email: 'dan@example.com',
        password: 'DanPassw0rd!!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    const [user] = await ds.query(
      `SELECT id FROM users WHERE email = 'dan@example.com'`,
    );
    const token = await extractPlainToken(
      ds,
      user.id,
      'email_verification_tokens',
    );
    await ds.query(
      `UPDATE email_verification_tokens SET "expiresAt" = now() - interval '1 minute' WHERE "userId" = $1`,
      [user.id],
    );
    await request(app.getHttpServer())
      .get(`/api/v1/auth/verify?token=${token}`)
      .expect(400);
  });
});
