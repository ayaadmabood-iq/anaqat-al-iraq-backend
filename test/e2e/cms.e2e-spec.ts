import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, bootstrapOwner } from '../utils/app';

describe('CMS (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let ownerToken: string;

  beforeAll(async () => {
    ({ app, ds } = await bootTestApp());
    await bootstrapOwner(ds, 'cms-owner@example.com');
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'cms-owner@example.com', password: 'OwnerPassw0rd!' })
      .expect(200);
    ownerToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('draft → publish → public sees published, versions grow', async () => {
    const http = request(app.getHttpServer());

    // public read before anything is saved returns null
    const before = await http.get('/api/v1/content/page.about').expect(200);
    expect(before.body.value).toBeNull();

    // save a draft
    await http
      .put('/api/v1/admin/content/page.about/draft')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        key: 'page.about',
        value: {
          ar: { title: 'عن المنصة', body: '<p>سيء<script>x</script>مرحبا</p>' },
        },
      })
      .expect(200);

    // still no published value
    const publicAfterDraft = await http.get('/api/v1/content/page.about').expect(200);
    expect(publicAfterDraft.body.value).toBeNull();

    // publish
    await http
      .post('/api/v1/admin/content/page.about/publish')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    // public sees the sanitized version
    const publicAfterPublish = await http.get('/api/v1/content/page.about').expect(200);
    const body = publicAfterPublish.body.value.ar.body as string;
    expect(body).not.toContain('script');
    expect(body).toContain('سيء');
    expect(body).toContain('مرحبا');

    // save + publish again to grow versions
    await http
      .put('/api/v1/admin/content/page.about/draft')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        key: 'page.about',
        value: { ar: { title: 'عن المنصة', body: 'v3' } },
      })
      .expect(200);
    await http
      .post('/api/v1/admin/content/page.about/publish')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    const versions = await http
      .get('/api/v1/admin/content/page.about/versions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(versions.body.length).toBeGreaterThanOrEqual(3);
    const actions = versions.body.map((v: { action: string }) => v.action);
    expect(actions).toContain('draft_saved');
    expect(actions).toContain('published');

    // audit trail recorded the publish
    const [audit] = await ds.query(
      `SELECT COUNT(*)::int AS c FROM audit_logs WHERE action IN ('cms.draft_saved', 'cms.published')`,
    );
    expect(audit.c).toBeGreaterThanOrEqual(3);
  });

  it('rejects unknown public page keys', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/v1/content/page.secret').expect(404);
  });
});
