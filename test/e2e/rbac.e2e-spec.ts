import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, bootstrapOwner } from '../utils/app';
import * as bcrypt from 'bcrypt';

async function insertUser(
  ds: DataSource,
  email: string,
  role: string,
): Promise<string> {
  // We insert users through a normal path (role=customer) then update the
  // role via a SQL bypass — but only for the non-super_admin roles. The
  // super_admin trigger will still refuse to admit them.
  const hash = await bcrypt.hash('Passw0rd!', 4);
  await ds.query(
    `INSERT INTO users ("fullName", email, "passwordHash", role, "emailVerified", "isActive", "privacyAccepted", "termsAccepted", "acceptedAt", "tokenVersion")
     VALUES ($1, $2, $3, 'customer', true, true, true, true, now(), 1)`,
    ['Test ' + role, email, hash],
  );
  if (role !== 'customer') {
    await ds.query(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
  }
  const [row] = await ds.query(`SELECT id FROM users WHERE email = $1`, [email]);
  return row.id;
}

async function loginToken(app: INestApplication, email: string): Promise<string> {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: 'Passw0rd!' })
    .expect(200);
  return login.body.accessToken;
}

describe('RBAC (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
    await bootstrapOwner(ds, 'owner-rbac@example.com');
    await insertUser(ds, 'content@example.com', 'content_manager');
    await insertUser(ds, 'finance@example.com', 'finance_manager');
    await insertUser(ds, 'support@example.com', 'support');
    await insertUser(ds, 'customer@example.com', 'customer');
  });

  afterAll(async () => {
    await app.close();
  });

  it('super_admin bootstrap trigger refuses runtime insert of a super_admin', async () => {
    const bcrypt2 = await import('bcrypt');
    const hash = await bcrypt2.hash('Passw0rd!', 4);
    await expect(
      ds.query(
        `INSERT INTO users ("fullName", email, "passwordHash", role, "emailVerified", "isActive", "privacyAccepted", "termsAccepted", "acceptedAt", "tokenVersion")
         VALUES ('Sneak', 'sneak@example.com', $1, 'super_admin', true, true, true, true, now(), 1)`,
        [hash],
      ),
    ).rejects.toThrow(/super_admin/);
  });

  it('trigger refuses UPDATE that promotes a non-super_admin to super_admin', async () => {
    await expect(
      ds.query(`UPDATE users SET role = 'super_admin' WHERE email = 'content@example.com'`),
    ).rejects.toThrow(/super_admin/);
  });

  it('trigger accepts a bootstrap-flagged INSERT of super_admin', async () => {
    const bcrypt2 = await import('bcrypt');
    const hash = await bcrypt2.hash('Passw0rd!', 4);
    await ds.transaction(async (tx) => {
      await tx.query(`SET LOCAL qasdiya.bootstrap = 'on'`);
      await tx.query(
        `INSERT INTO users ("fullName", email, "passwordHash", role, "emailVerified", "isActive", "privacyAccepted", "termsAccepted", "acceptedAt", "tokenVersion")
         VALUES ('Second Owner', 'owner2@example.com', $1, 'super_admin', true, true, true, true, now(), 1)`,
        [hash],
      );
    });
    const [row] = await ds.query(
      `SELECT role FROM users WHERE email = 'owner2@example.com'`,
    );
    expect(row.role).toBe('super_admin');
  });

  it('content_manager can write books but not touch bank-accounts or approve orders', async () => {
    const http = request(app.getHttpServer());
    const cmToken = await loginToken(app, 'content@example.com');

    await http
      .post('/api/v1/admin/books')
      .set('Authorization', `Bearer ${cmToken}`)
      .send({
        slug: 'cm-book',
        title: { ar: 'كتاب' },
        author: { ar: 'مؤلف' },
        masterPdfPath: 'cm-book/master.pdf',
        priceUsd: '5.00',
      })
      .expect(201);

    await http
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${cmToken}`)
      .expect(403);

    // no order exists to approve; but even the attempt should be 403 (role)
    await http
      .post(`/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/approve`)
      .set('Authorization', `Bearer ${cmToken}`)
      .expect(403);
  });

  it('finance_manager can list bank accounts but not create books', async () => {
    const http = request(app.getHttpServer());
    const fToken = await loginToken(app, 'finance@example.com');
    await http
      .get('/api/v1/admin/bank-accounts')
      .set('Authorization', `Bearer ${fToken}`)
      .expect(200);
    await http
      .post('/api/v1/admin/books')
      .set('Authorization', `Bearer ${fToken}`)
      .send({
        slug: 'f-book',
        title: { ar: 'x' },
        author: { ar: 'x' },
        masterPdfPath: 'f-book/master.pdf',
        priceUsd: '1.00',
      })
      .expect(403);
  });

  it('support can look up copies but not deactivate customers', async () => {
    const http = request(app.getHttpServer());
    const sToken = await loginToken(app, 'support@example.com');
    await http
      .get('/api/v1/admin/lookup/copies?buyer=alice')
      .set('Authorization', `Bearer ${sToken}`)
      .expect(200);
    const [customer] = await ds.query(
      `SELECT id FROM users WHERE email = 'customer@example.com'`,
    );
    await http
      .post(`/api/v1/admin/customers/${customer.id}/deactivate`)
      .set('Authorization', `Bearer ${sToken}`)
      .expect(403);
  });

  it('customer cannot reach any /admin route', async () => {
    const http = request(app.getHttpServer());
    const cToken = await loginToken(app, 'customer@example.com');
    for (const p of [
      '/api/v1/admin/books',
      '/api/v1/admin/orders',
      '/api/v1/admin/summary',
      '/api/v1/admin/reports/sales',
      '/api/v1/admin/lookup/copies?buyer=x',
    ]) {
      await http.get(p).set('Authorization', `Bearer ${cToken}`).expect(403);
    }
  });

  it('PATCH /auth/me refuses to touch the role field', async () => {
    const http = request(app.getHttpServer());
    const cToken = await loginToken(app, 'customer@example.com');
    // whitelist validation strips it silently, so the DB never sees it — assert on the outcome
    await http
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${cToken}`)
      .send({ role: 'super_admin', fullName: 'Sneaky' })
      .expect(400); // forbidNonWhitelisted → 400
    const [row] = await ds.query(
      `SELECT role FROM users WHERE email = 'customer@example.com'`,
    );
    expect(row.role).toBe('customer');
  });
});
