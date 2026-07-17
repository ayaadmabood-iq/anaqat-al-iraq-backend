import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, bootstrapOwner } from '../utils/app';
import { generateSync } from 'otplib';

describe('MFA (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('super_admin login is rejected without a valid TOTP code', async () => {
    const owner = await bootstrapOwner(ds, 'mfa-owner@example.com');
    const http = request(app.getHttpServer());

    // missing code
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-owner@example.com', password: 'OwnerPassw0rd!' })
      .expect(401);

    // wrong code — 'zzzzzz' doesn't match /^\d{6,8}$/ so TOTP path is skipped
    // and no recovery code equals its hash either.
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-owner@example.com', password: 'OwnerPassw0rd!', mfaCode: 'zzzzzz' })
      .expect(401);

    // correct code
    const res = await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-owner@example.com', password: 'OwnerPassw0rd!', mfaCode: owner.mfaCode() })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('a customer who enrols MFA is challenged on next login', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'MFA Buyer',
        email: 'mfa-buyer@example.com',
        password: 'BuyerPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = 'mfa-buyer@example.com'`,
    );
    const login1 = await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-buyer@example.com', password: 'BuyerPassw0rd!' })
      .expect(200);
    const token = login1.body.accessToken;

    // Enrol
    const setup = await http
      .post('/api/v1/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(setup.body.secret).toBeDefined();
    const secret = setup.body.secret as string;
    const code = generateSync({ algorithm: 'sha1', digits: 6, period: 30, secret });
    await http
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
      .expect(200);

    // The old JWT is invalidated (tokenVersion bumped).
    await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // Login now requires the code.
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-buyer@example.com', password: 'BuyerPassw0rd!' })
      .expect(401);
    const codeFresh = generateSync({ algorithm: 'sha1', digits: 6, period: 30, secret });
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-buyer@example.com', password: 'BuyerPassw0rd!', mfaCode: codeFresh })
      .expect(200);
  });

  it('recovery codes work exactly once', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/auth/register')
      .send({
        fullName: 'MFA Recovery',
        email: 'mfa-rec@example.com',
        password: 'RecPassw0rd!',
        privacyAccepted: true,
        termsAccepted: true,
      })
      .expect(201);
    await ds.query(`UPDATE users SET "emailVerified" = true WHERE email = 'mfa-rec@example.com'`);
    const login = await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-rec@example.com', password: 'RecPassw0rd!' })
      .expect(200);
    const token = login.body.accessToken;
    const setup = await http
      .post('/api/v1/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const secret = setup.body.secret as string;
    const enable = await http
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: generateSync({ algorithm: 'sha1', digits: 6, period: 30, secret }) })
      .expect(200);
    const recovery: string[] = enable.body.recoveryCodes;
    expect(recovery.length).toBe(8);

    const usedCode = recovery[0];
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-rec@example.com', password: 'RecPassw0rd!', mfaCode: usedCode })
      .expect(200);
    // Second use of the same recovery code is rejected.
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-rec@example.com', password: 'RecPassw0rd!', mfaCode: usedCode })
      .expect(401);
    // A different recovery code still works.
    await http
      .post('/api/v1/auth/login')
      .send({ email: 'mfa-rec@example.com', password: 'RecPassw0rd!', mfaCode: recovery[1] })
      .expect(200);
  });
});
