import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { generateSecret as otplibGenerateSecret, generateSync as otplibGenerateSync } from 'otplib';

/**
 * Boot the real AppModule against the test Postgres. Drops and re-migrates
 * the schema so tests are hermetic even when run repeatedly.
 */
export async function bootTestApp(): Promise<{
  app: INestApplication;
  ds: DataSource;
}> {
  // Make the storage tree writable + isolated for each test run.
  const storageRoot = path.join('/tmp', `qasdiya-test-${process.pid}-${Date.now()}`);
  for (const sub of ['books', 'generated', 'transfers', 'keys']) {
    fs.mkdirSync(path.join(storageRoot, sub), { recursive: true });
  }
  process.env.STORAGE_ROOT = storageRoot;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Reset schema before boot. We use synchronize() (same code path as the
  // InitSchema migration) then run the remaining migrations — the schema
  // trigger, in particular — so tests exercise the exact production
  // guardrails.
  const ds = moduleRef.get(DataSource);
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await ds.synchronize(false);
  // Emulate the trigger migration since we skipped runMigrations().
  await ds.query(`
    CREATE OR REPLACE FUNCTION qasdiya_guard_super_admin() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE bootstrap TEXT;
    BEGIN
      bootstrap := current_setting('qasdiya.bootstrap', true);
      IF NEW.role = 'super_admin' AND (bootstrap IS NULL OR bootstrap <> 'on') THEN
        RAISE EXCEPTION 'super_admin role is bootstrap-only; use the bootstrap:owner migration'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await ds.query(`DROP TRIGGER IF EXISTS trg_users_guard_super_admin ON users`);
  await ds.query(`
    CREATE TRIGGER trg_users_guard_super_admin
      BEFORE INSERT OR UPDATE OF role ON users
      FOR EACH ROW
      EXECUTE FUNCTION qasdiya_guard_super_admin();
  `);

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return { app, ds };
}

export async function seedPublishedBook(
  ds: DataSource,
  slug = 'test-book',
): Promise<{ bookId: string }> {
  const dir = path.join(process.env.STORAGE_ROOT!, 'books', slug);
  fs.mkdirSync(dir, { recursive: true });
  // Minimal valid PDF the fingerprint pipeline can load.
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const p = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  p.drawText('test master', { x: 40, y: 400, size: 24, font });
  fs.writeFileSync(path.join(dir, 'master.pdf'), Buffer.from(await doc.save()));

  const [row] = await ds.query(
    `INSERT INTO books (slug, title, author, description, "masterPdfPath", "priceUsd", status, "publishedAt", "editionVersion", "isFeatured")
     VALUES ($1, '{"ar":"عنوان","en":"Title"}'::jsonb, '{"ar":"مؤلف"}'::jsonb, '{}'::jsonb, $2, '10.00', 'published', now(), '1', true)
     RETURNING id`,
    [slug, `${slug}/master.pdf`],
  );
  return { bookId: row.id };
}

/**
 * Bootstraps a super_admin via the schema-level path (SET LOCAL
 * qasdiya.bootstrap = 'on') — mirrors scripts/bootstrap-owner.ts. MFA is
 * enabled so tests exercise the same login path as production.
 */
export async function bootstrapOwner(
  ds: DataSource,
  email = 'owner@example.com',
): Promise<{ userId: string; mfaSecret: string; mfaCode: () => string }> {
  const hash = await bcrypt.hash('OwnerPassw0rd!', 4);
  const secret = otplibGenerateSecret({ length: 20 });
  await ds.transaction(async (tx) => {
    await tx.query(`SET LOCAL qasdiya.bootstrap = 'on'`);
    await tx.query(
      `INSERT INTO users ("fullName", email, "passwordHash", role, "emailVerified", "isActive",
                          "privacyAccepted", "termsAccepted", "acceptedAt", "tokenVersion",
                          "mfaSecret", "mfaEnabled")
       VALUES ('Owner', $1, $2, 'super_admin', true, true, true, true, now(), 1, $3, true)`,
      [email, hash, secret],
    );
  });
  const [row] = await ds.query(`SELECT id FROM users WHERE email = $1`, [email]);
  const mfaCode = () =>
    otplibGenerateSync({ algorithm: 'sha1', digits: 6, period: 30, secret });
  return { userId: row.id, mfaSecret: secret, mfaCode };
}
