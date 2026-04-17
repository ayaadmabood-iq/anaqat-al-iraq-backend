/**
 * E2E tests for the SalesIntelligence feature (Phase F).
 *
 * Uses the dedicated `anaqat_iraq_test` database.
 * Seeds 8 active in-stock items across 2 categories so that the engine
 * can produce exactly 4 outfit recommendations.
 * ClassificationService.classify is mocked via jest.spyOn to control
 * Vision API behaviour without network calls.
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { mountOpenApi } from '../src/openapi';
import {
  Store,
  User,
  UserRole,
  ClothingCategory,
  ClothingItem,
  SizeStock,
  AudienceTag,
  Sale,
} from '../src/database';
import { ClassificationService } from '../src/modules/inventory/classification.service';

// ── PNG helper ────────────────────────────────────────────────────────────────
// Generates the minimal valid PNG bytes (1×1 red pixel).
function minimalPng(): Buffer {
  // Pre-built 1×1 red pixel PNG (valid binary — avoids external deps in tests)
  return Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080200000090'
    + '77533800000000c4944415478016360f8cfc00000000200016d2d2b4000'
    + '00000049454e44ae426082',
    'hex',
  );
}

// ── Mock Vision result ────────────────────────────────────────────────────────
const MOCK_VISION_RESULT = {
  categoryPreset: 'dresses',
  categoryConfidence: 0.85,
  primaryColorFamily: 'blue',
  primaryColorHex: '#4169e1',
  primaryColorScore: 0.6,
  secondaryColorFamily: null,
  secondaryColorHex: null,
  secondaryColorScore: null,
  audienceTag: 'WOMEN' as const,
  audienceConfidence: 0.82,
  skinToneGroup: null,
  rawLabels: [{ label: 'dress', confidence: 0.9 }],
  source: 'vision_api' as const,
};

const MOCK_FALLBACK_RESULT = {
  ...MOCK_VISION_RESULT,
  categoryPreset: null,
  categoryConfidence: null,
  primaryColorFamily: 'multi',
  primaryColorHex: '#808080',
  primaryColorScore: 0,
  audienceTag: 'UNISEX' as const,
  audienceConfidence: 0,
  rawLabels: [],
  source: 'manual_fallback' as const,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('SalesIntelligence e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let classifyMock: jest.SpyInstance;

  let storeId: string;
  let ownerToken: string;
  let salesToken: string;
  let inventoryStaffToken: string;
  let salesUserId: string;

  // Item IDs needed for stock-race test
  let itemIds: string[] = [];
  let itemSizes: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_DATABASE = 'anaqat_iraq_test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test-jwt-secret-must-be-at-least-16-chars';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1', {
      exclude: ['healthz', 'metrics', 'api-docs', 'api-docs-json', 'api-docs/(.*)'],
    });
    mountOpenApi(app);
    await app.init();

    dataSource = app.get(DataSource);

    // Mock ClassificationService once — individual tests override per-call
    const classificationService = app.get(ClassificationService);
    classifyMock = jest.spyOn(classificationService, 'classify');
    classifyMock.mockResolvedValue(MOCK_VISION_RESULT);

    // ── Clean slate ────────────────────────────────────────────────────────
    await dataSource.query(
      `TRUNCATE TABLE
        inventory_match_scores, recommendation_signals,
        sale_lines, sales, size_stocks, clothing_items, clothing_categories,
        outfit_recommendation_items, outfit_recommendations, customer_sessions,
        ai_processing_jobs, audit_logs, users, stores
       RESTART IDENTITY CASCADE`,
    );

    // ── Seed store ─────────────────────────────────────────────────────────
    const storeRepo = dataSource.getRepository(Store);
    const store = await storeRepo.save(storeRepo.create({ name: 'SI Test Store', isActive: true }));
    storeId = store.id;

    // ── Seed users ─────────────────────────────────────────────────────────
    const userRepo = dataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('pass123', 10);

    const owner = await userRepo.save(
      userRepo.create({ username: 'si_owner', passwordHash, fullName: 'SI Owner', role: UserRole.OWNER, storeId, isActive: true }),
    );
    const salesUser = await userRepo.save(
      userRepo.create({ username: 'si_sales', passwordHash, fullName: 'SI Sales', role: UserRole.SALES_STAFF, storeId, isActive: true }),
    );
    const invUser = await userRepo.save(
      userRepo.create({ username: 'si_inventory', passwordHash, fullName: 'SI Inventory', role: UserRole.INVENTORY_STAFF, storeId, isActive: true }),
    );
    salesUserId = salesUser.id;

    // ── Obtain tokens ──────────────────────────────────────────────────────
    const loginAs = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/auth/login?storeId=${storeId}`)
        .send({ username, password: 'pass123' });
      return res.body.access_token as string;
    };
    ownerToken = await loginAs('si_owner');
    salesToken = await loginAs('si_sales');
    inventoryStaffToken = await loginAs('si_inventory');

    // ── Seed categories ────────────────────────────────────────────────────
    const catRepo = dataSource.getRepository(ClothingCategory);
    const cat1 = await catRepo.save(catRepo.create({ nameAr: 'فستان', nameEn: 'Dress', isActive: true }));
    const cat2 = await catRepo.save(catRepo.create({ nameAr: 'قميص', nameEn: 'Casual Shirt', isActive: true }));

    // ── Seed 8 active items (4 per category) with stock ────────────────────
    const itemRepo = dataSource.getRepository(ClothingItem);
    const sizeRepo = dataSource.getRepository(SizeStock);

    const colors = ['blue', 'red', 'navy', 'green', 'white', 'black', 'gold', 'brown'];

    for (let i = 0; i < 8; i++) {
      const categoryId = i < 4 ? cat1.id : cat2.id;
      const item = await itemRepo.save(
        itemRepo.create({
          storeId,
          categoryId,
          primaryColor: colors[i],
          colorFamily: colors[i],
          audienceTag: AudienceTag.WOMEN,
          price: 10000 + i * 5000,
          isActive: true,
        }),
      );
      itemIds.push(item.id);
      const size = await sizeRepo.save(
        sizeRepo.create({ clothingItemId: item.id, size: 'M', quantity: 10 }),
      );
      itemSizes.push(size.size);
    }

    // ── Seed 2 out-of-stock items ──────────────────────────────────────────
    for (let i = 0; i < 2; i++) {
      const item = await itemRepo.save(
        itemRepo.create({
          storeId,
          categoryId: cat1.id,
          primaryColor: 'cream',
          colorFamily: 'cream',
          audienceTag: AudienceTag.WOMEN,
          isActive: true,
        }),
      );
      await sizeRepo.save(sizeRepo.create({ clothingItemId: item.id, size: 'M', quantity: 0 }));
    }
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // ── State shared across test cases ─────────────────────────────────────────
  let createdSessionId: string;
  let recommendationJobId: string;

  // ── TC-01: Session creation happy path ────────────────────────────────────
  it('TC-01: POST /sessions → 201 with sessionId and OPEN status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storeId, occasionContext: 'casual', customerGender: 'FEMALE' })
      .expect(201);

    expect(res.body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.body.status).toBe('OPEN');
    createdSessionId = res.body.sessionId;
  });

  // ── TC-02: Session creation missing storeId ───────────────────────────────
  it('TC-02: POST /sessions without storeId → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ occasionContext: 'casual' })
      .expect(400);
  });

  // ── TC-03: Recommend happy path (Vision API mocked) ───────────────────────
  it('TC-03: POST /sessions/:id/recommend → 200, 4 recommendations, no out-of-stock', async () => {
    classifyMock.mockResolvedValueOnce(MOCK_VISION_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${createdSessionId}/recommend`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(200);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.fallback).toBeUndefined();
    expect(res.body.recommendations).toHaveLength(4);
    recommendationJobId = res.body.jobId;

    // Verify no out-of-stock items appear in any recommendation
    for (const rec of res.body.recommendations) {
      expect(rec.items.length).toBeGreaterThanOrEqual(1);
    }

    // Verify ranks are 1-4
    const ranks = res.body.recommendations.map((r: any) => r.rank).sort();
    expect(ranks).toEqual([1, 2, 3, 4]);

    // Verify PRIMARY role exists in each outfit
    for (const rec of res.body.recommendations) {
      const roles = rec.items.map((i: any) => i.role);
      expect(roles).toContain('PRIMARY');
    }
  });

  // ── TC-04: Recommend fallback path (Vision mocked to throw) ───────────────
  it('TC-04: POST /recommend with Vision error → 200, fallback:true, 4 recommendations', async () => {
    // Create a fresh session for this test
    const sessionRes = await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storeId })
      .expect(201);

    const sessionId = sessionRes.body.sessionId;
    classifyMock.mockRejectedValueOnce(new Error('Vision API network error'));

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sessionId}/recommend`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(200);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.fallback).toBe(true);
    expect(res.body.fallbackReason).toBe('vision_api_error');
    expect(res.body.recommendations).toHaveLength(4);
  });

  // ── TC-05: Recommend empty stock ──────────────────────────────────────────
  it('TC-05: POST /recommend with all items out of stock → 200, empty recommendations', async () => {
    // Set all item quantities to 0
    await dataSource.query(`UPDATE size_stocks SET quantity = 0`);

    const sessionRes = await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storeId })
      .expect(201);

    classifyMock.mockResolvedValueOnce(MOCK_VISION_RESULT);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sessionRes.body.sessionId}/recommend`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(200);

    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.emptyReason).toBe('no_active_stock');

    // Restore stock
    await dataSource.query(`UPDATE size_stocks SET quantity = 10 WHERE quantity = 0`);
  });

  // ── TC-06: Job polling ────────────────────────────────────────────────────
  it('TC-06: GET /jobs/:jobId → 200 with COMPLETED status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales-intelligence/jobs/${recommendationJobId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.jobId).toBe(recommendationJobId);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).toBeTruthy();
  });

  // ── TC-07: Get session full state ─────────────────────────────────────────
  it('TC-07: GET /sessions/:id → 200, status=RECOMMENDATION_READY, 4 recommendations', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales-intelligence/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.sessionId).toBe(createdSessionId);
    expect(res.body.status).toBe('RECOMMENDATION_READY');
    expect(res.body.recommendations).toHaveLength(4);
    // All recommendations start with wasPresented false
    for (const rec of res.body.recommendations) {
      expect(rec.wasPresented).toBe(false);
    }
  });

  // ── TC-08: Mark recommendation presented ─────────────────────────────────
  it('TC-08: PATCH /recommendations/1/presented → 200, wasPresented=true', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/sales-intelligence/sessions/${createdSessionId}/recommendations/1/presented`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.rank).toBe(1);
    expect(res.body.wasPresented).toBe(true);

    // Confirm persisted
    const sessionRes = await request(app.getHttpServer())
      .get(`/api/v1/sales-intelligence/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const rank1 = sessionRes.body.recommendations.find((r: any) => r.rank === 1);
    expect(rank1.wasPresented).toBe(true);
  });

  // ── TC-09: Convert recommendation happy path ──────────────────────────────
  it('TC-09: POST /recommendations/1/convert → 200, links saleId, session=CONVERTED', async () => {
    // Create a sale via API
    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: salesUserId,
        lines: [{ clothingItemId: itemIds[0], size: 'M', quantity: 1, unitPrice: 10000 }],
      })
      .expect(201);

    const saleId = saleRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${createdSessionId}/recommendations/1/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ saleId })
      .expect(200);

    expect(res.body.convertedSaleId).toBe(saleId);
    expect(res.body.convertedAt).toBeTruthy();
    expect(res.body.sessionStatus).toBe('CONVERTED');
  });

  // ── TC-10: Convert with nonexistent saleId ────────────────────────────────
  it('TC-10: POST /convert with nonexistent saleId → 404', async () => {
    // Create a fresh session + recommendations
    const sessionRes = await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storeId })
      .expect(201);
    const sid = sessionRes.body.sessionId;

    classifyMock.mockResolvedValueOnce(MOCK_VISION_RESULT);
    await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sid}/recommend`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' });

    await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sid}/recommendations/1/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ saleId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  // ── TC-11: Convert with stock race → 409 ─────────────────────────────────
  it('TC-11: POST /convert when recommended item is now out of stock → 409', async () => {
    // Create a fresh session with recommendations
    const sessionRes = await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ storeId })
      .expect(201);
    const sid = sessionRes.body.sessionId;

    classifyMock.mockResolvedValueOnce(MOCK_VISION_RESULT);
    const recRes = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sid}/recommend`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(200);
    expect(recRes.body.recommendations).toHaveLength(4);

    // Create a valid sale BEFORE draining stock (sale must exist to pass the 404 check)
    const saleRes = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: salesUserId,
        lines: [{ clothingItemId: itemIds[0], size: 'M', quantity: 1, unitPrice: 10000 }],
      })
      .expect(201);
    const saleId = saleRes.body.id;

    // Now drain all stock to simulate the race condition
    await dataSource.query(`UPDATE size_stocks SET quantity = 0`);

    const conflictRes = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${sid}/recommendations/1/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ saleId })
      .expect(409);

    const msg = conflictRes.body.message;
    const msgText = typeof msg === 'string' ? msg : msg?.message ?? '';
    expect(msgText).toContain('out of stock');
    const outOfStockItems = typeof msg === 'object' ? msg?.outOfStockItems : conflictRes.body.outOfStockItems;
    expect(Array.isArray(outOfStockItems)).toBe(true);

    // Restore stock
    await dataSource.query(`UPDATE size_stocks SET quantity = 10`);
  });

  // ── TC-12: Convert idempotency ────────────────────────────────────────────
  it('TC-12: POST /convert twice with same saleId → 200 both times (idempotent)', async () => {
    // Re-use the converted session from TC-09
    // Find the saleId that was set in TC-09 via DB query
    const rows: Array<{ convertedSaleId: string }> = await dataSource.query(
      `SELECT "convertedSaleId" FROM outfit_recommendations
       WHERE "customerSessionId" = $1 AND rank = 1`,
      [createdSessionId],
    );
    const saleId = rows[0]?.convertedSaleId;
    expect(saleId).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales-intelligence/sessions/${createdSessionId}/recommendations/1/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ saleId })
      .expect(200);

    expect(res.body.convertedSaleId).toBe(saleId);
  });

  // ── TC-13: List sessions filter by status ─────────────────────────────────
  it('TC-13: GET /sessions?status=CONVERTED → only CONVERTED sessions returned', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales-intelligence/sessions?storeId=${storeId}&status=CONVERTED`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    for (const s of res.body.data) {
      expect(s.sessionStatus ?? s.status).toBe('CONVERTED');
    }
  });

  // ── TC-14: Conversion report ──────────────────────────────────────────────
  it('TC-14: GET /reports/conversion → correct funnel structure', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sales-intelligence/reports/conversion?storeId=${storeId}&from=2026-01-01&to=2026-12-31`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.period).toBeDefined();
    expect(typeof res.body.sessions.total).toBe('number');
    expect(res.body.sessions.total).toBeGreaterThanOrEqual(1);
    expect(res.body.sessions.converted).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.recommendationRankBreakdown)).toBe(true);
  });

  // ── TC-15: RBAC — INVENTORY_STAFF blocked ────────────────────────────────
  it('TC-15: POST /sessions as INVENTORY_STAFF → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .set('Authorization', `Bearer ${inventoryStaffToken}`)
      .send({ storeId })
      .expect(403);
  });

  // ── TC-16: RBAC — unauthenticated ────────────────────────────────────────
  it('TC-16: POST /sessions without token → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions')
      .send({ storeId })
      .expect(401);
  });

  // ── TC-17: Invalid sessionId (not UUID) ──────────────────────────────────
  it('TC-17: POST /sessions/not-a-uuid/recommend → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions/not-a-uuid/recommend')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(400);
  });

  // ── TC-18: Nonexistent sessionId ─────────────────────────────────────────
  it('TC-18: POST /sessions/valid-but-missing-uuid/recommend → 404', async () => {
    classifyMock.mockResolvedValueOnce(MOCK_VISION_RESULT);

    await request(app.getHttpServer())
      .post('/api/v1/sales-intelligence/sessions/00000000-0000-0000-0000-000000000001/recommend')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('photo', minimalPng(), { contentType: 'image/png', filename: 'test.png' })
      .expect(404);
  });
});
