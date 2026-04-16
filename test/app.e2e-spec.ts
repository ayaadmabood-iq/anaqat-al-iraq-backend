/**
 * Regression tests covering the three bugs fixed in this hardening pass:
 *   1. JWT issued at login must authenticate a protected endpoint
 *   2. GET /sales must return 200 without query params
 *   3. POST /inventory/items with sizes must not duplicate-key on cascade
 * Plus RBAC contracts that must not silently regress.
 *
 * Uses a dedicated database `anaqat_iraq_test` so dev data is untouched.
 * Seeds minimal rows programmatically in beforeAll.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  Store,
  User,
  UserRole,
  ClothingCategory,
} from '../src/database';

describe('App e2e — post-hardening regression suite', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let storeId: string;
  let ownerUserId: string;
  let salesUserId: string;
  let categoryId: string;
  let ownerToken: string;
  let salesToken: string;

  beforeAll(async () => {
    // Point all config at the dedicated test database before Nest boots.
    process.env.NODE_ENV = 'test';
    process.env.DB_DATABASE = 'anaqat_iraq_test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test-jwt-secret-must-be-at-least-16-chars';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mirror the global pipe configuration used in main.ts so that behaviour
    // under test matches production behaviour.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');

    await app.init();

    dataSource = app.get(DataSource);

    // Clean slate in known order to respect FK constraints.
    await dataSource.query(
      'TRUNCATE TABLE sale_lines, sales, size_stocks, clothing_items, clothing_categories, users, stores, audit_logs, customer_sessions, outfit_recommendations, outfit_recommendation_items, ai_processing_jobs RESTART IDENTITY CASCADE',
    );

    const storeRepo = dataSource.getRepository(Store);
    const userRepo = dataSource.getRepository(User);
    const categoryRepo = dataSource.getRepository(ClothingCategory);
    const passwordHash = await bcrypt.hash('demo123', 10);

    const store = await storeRepo.save(
      storeRepo.create({ name: 'Test Store', isActive: true }),
    );
    storeId = store.id;

    const owner = await userRepo.save(
      userRepo.create({
        username: 'owner',
        passwordHash,
        fullName: 'Test Owner',
        role: UserRole.OWNER,
        storeId,
        isActive: true,
      }),
    );
    ownerUserId = owner.id;

    const salesStaff = await userRepo.save(
      userRepo.create({
        username: 'sales',
        passwordHash,
        fullName: 'Test Sales',
        role: UserRole.SALES_STAFF,
        storeId,
        isActive: true,
      }),
    );
    salesUserId = salesStaff.id;

    const cat = await categoryRepo.save(
      categoryRepo.create({ nameAr: 'قميص', nameEn: 'Shirt', isActive: true }),
    );
    categoryId = cat.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  /**
   * Regression #1 — JWT secret contract.
   * The original bug signed tokens with one secret and verified with
   * another. This test proves the full round-trip: login issues a token,
   * and the same token is accepted by a protected endpoint.
   */
  it('login issues a JWT that authenticates a protected endpoint', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .query({ storeId })
      .send({ username: 'owner', password: 'demo123' })
      .expect(201);

    expect(loginRes.body.access_token).toMatch(/^eyJ/);
    expect(loginRes.body.user.role).toBe('OWNER');
    ownerToken = loginRes.body.access_token;

    const salesLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .query({ storeId })
      .send({ username: 'sales', password: 'demo123' })
      .expect(201);
    salesToken = salesLogin.body.access_token;

    const protectedRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/stock/total')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(protectedRes.body).toHaveProperty('total');
  });

  it('rejects missing or invalid storeId on login with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'demo123' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .query({ storeId: 'not-a-uuid' })
      .send({ username: 'owner', password: 'demo123' })
      .expect(400);
  });

  it('protected endpoint rejects missing or wrong token with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock/total')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock/total')
      .set('Authorization', 'Bearer deadbeef')
      .expect(401);
  });

  /**
   * Regression #2 — Query-string coercion on /sales.
   * Without the DefaultValuePipe + ParseIntPipe, calling GET /sales with
   * no query params crashed with TypeORMError 'skip is not a number'.
   */
  it('GET /sales returns 200 without query params', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('sales');
    expect(Array.isArray(res.body.sales)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /sales accepts explicit limit/offset', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales')
      .query({ limit: 10, offset: 0 })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('total');
  });

  /**
   * Pipeline order for primitive @Query('limit', DefaultValuePipe, ParseIntPipe):
   *   global ValidationPipe (transform:true) → "abc" becomes NaN
   *   → DefaultValuePipe → NaN replaced by 50
   *   → ParseIntPipe accepts 50
   * Net effect: the request soft-falls-back to the default rather than 500.
   * The regression guarantee is "no 500 from coercion", which this proves.
   */
  it('GET /sales with non-numeric limit falls back to default (no 500)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales')
      .query({ limit: 'abc' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('sales');
    expect(res.body).toHaveProperty('total');
  });

  /**
   * Regression #3 — cascade-aware creation.
   * The original bug inserted size_stocks twice (once via cascade from
   * the parent item save, once via explicit sizeStockRepository.save),
   * producing a UQ_clothing_item_size duplicate-key violation.
   */
  it('POST /inventory/items with sizes creates item and all sizes exactly once', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        categoryId,
        primaryColor: 'أحمر',
        audienceTag: 'WOMEN',
        price: 45000,
        sizes: [
          { size: 'S', quantity: 3 },
          { size: 'M', quantity: 5 },
          { size: 'L', quantity: 7 },
        ],
      })
      .expect(201);

    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.body.sizes).toHaveLength(3);

    // DB-level assertion: exactly 3 rows, no duplicates
    const rows = await dataSource.query(
      'SELECT size, quantity FROM size_stocks WHERE "clothingItemId" = $1 ORDER BY size',
      [res.body.id],
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r: any) => r.size).sort()).toEqual(['L', 'M', 'S']);
  });

  /**
   * RBAC contract — SALES_STAFF must not DELETE items (MANAGER+ only).
   */
  it('RBAC: SALES_STAFF cannot DELETE inventory items (403)', async () => {
    // Create an item first so there is something to try to delete
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        categoryId,
        primaryColor: 'أزرق',
        audienceTag: 'MEN',
        price: 30000,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/inventory/items/${createRes.body.id}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });

  /**
   * RBAC contract — SALES_STAFF must not CREATE users (OWNER/MANAGER only).
   */
  it('RBAC: SALES_STAFF cannot POST /users (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        username: 'evil_user',
        password: 'demo123',
        fullName: 'Evil',
        role: 'SALES_STAFF',
      })
      .expect(403);
  });

  /**
   * Validation contract — inline/unknown fields on /users must be rejected,
   * not silently stored. whitelist + forbidNonWhitelisted must enforce this.
   */
  it('POST /users rejects unknown fields with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        username: 'test_user',
        password: 'demo123',
        fullName: 'Test',
        role: 'SALES_STAFF',
        isAdmin: true,
      })
      .expect(400);
  });

  /**
   * Validation contract — GET /inventory/items?isActive=false must return
   * inactive items, not all items. Regression guard for the bug introduced
   * by enableImplicitConversion converting 'false' → Boolean('false') = true.
   */
  it('GET /inventory/items?isActive=false filters correctly', async () => {
    const allActive = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .query({ isActive: 'true' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const allInactive = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .query({ isActive: 'false' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(allActive.body.length).toBeGreaterThan(0);
    expect(allInactive.body.length).toBe(0);
    expect(allActive.body.length).not.toBe(allInactive.body.length);
  });
});
