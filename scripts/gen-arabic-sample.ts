#!/usr/bin/env ts-node
/**
 * Generates a small Arabic sample of a personalized PDF and writes it to
 * `samples/arabic-sample.pdf`. Runs the real FingerprintService against a
 * throwaway master + fake data — no database access needed.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/gen-arabic-sample.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { SigningService } from '@/modules/fingerprint/signing.service';
import type { Book, IssuedCopy, IssuedCopyGeneration, Order, User } from '@/database';

function stubRepo<T extends object>(): {
  save: (row: T) => Promise<T>;
  create: (row: T) => T;
  findOne: () => Promise<null>;
} {
  return {
    save: async (row) => {
      // Make sure the row has an id so downstream code that expects one is happy.
      // We do not exercise DB-side triggers here.
      (row as { id?: string }).id ??= '00000000-0000-0000-0000-000000000001';
      return row;
    },
    create: (row) => row,
    findOne: async () => null,
  };
}

async function main() {
  const rootStorage = fs.mkdtempSync('/tmp/qasdiya-arabic-sample-');
  fs.mkdirSync(path.join(rootStorage, 'books', 'sample-arabic'), { recursive: true });
  fs.mkdirSync(path.join(rootStorage, 'generated'), { recursive: true });
  process.env.STORAGE_ROOT = rootStorage;
  process.env.COPY_SIGNING_KEY =
    process.env.COPY_SIGNING_KEY ||
    'ff'.repeat(32);

  // Produce a tiny plain master PDF.
  const master = await PDFDocument.create();
  const p = master.addPage([595, 842]);
  const helv = await master.embedFont(StandardFonts.Helvetica);
  p.drawText('Master content page — replaced at runtime', {
    x: 40,
    y: 400,
    size: 16,
    font: helv,
  });
  fs.writeFileSync(
    path.join(rootStorage, 'books', 'sample-arabic', 'master.pdf'),
    Buffer.from(await master.save()),
  );

  const signing = new SigningService();
  (signing as unknown as { load: () => void }).load();

  const fingerprint = new FingerprintService(
    stubRepo<IssuedCopy>() as unknown as import('typeorm').Repository<IssuedCopy>,
    stubRepo<IssuedCopyGeneration>() as unknown as import('typeorm').Repository<IssuedCopyGeneration>,
    signing,
  );

  const book: Book = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    slug: 'sample-arabic',
    title: { ar: 'من طين ونفخة', en: 'Of Clay and a Breath' },
    author: { ar: 'د. إياد محمد عبود', en: 'Dr. Iyad Muhammad Abood' },
    description: {},
    coverImagePath: null,
    masterPdfPath: 'sample-arabic/master.pdf',
    editionVersion: '1',
    samplePdfPath: null,
    pageCount: 1,
    priceUsd: '15.00',
    priceIqd: null,
    keywords: [],
    categoryId: null,
    category: null,
    isFeatured: true,
    status: 'published',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [],
  };

  const user: User = {
    id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
    fullName: 'د. إياد محمد عبود',
    email: 'iyad@example.com',
    passwordHash: '',
    phone: '+964-000-0000000',
    country: 'العراق',
    city: 'بغداد',
    preferredLang: 'ar',
    role: 'customer',
    emailVerified: true,
    isActive: true,
    privacyAccepted: true,
    termsAccepted: true,
    acceptedAt: new Date(),
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [],
    issuedCopies: [],
  };

  const order: Order = {
    id: 'oooooooo-oooo-oooo-oooo-oooooooooooo',
    orderNumber: 'QSD-20260717-000123',
    userId: user.id,
    user,
    bookId: book.id,
    book,
    amount: '15.00',
    currency: 'USD',
    status: 'fulfilled',
    agreementAccepted: true,
    agreementAcceptedAt: new Date(),
    rejectionReason: null,
    approvedAt: new Date(),
    approvedByUserId: null,
    fulfilledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    transferProofs: [],
    issuedCopy: null,
  };

  const started = Date.now();
  const { copy, generation } = await fingerprint.issueCopyForOrder(order, book, user, {
    reason: 'initial',
  });
  const elapsed = Date.now() - started;

  const abs = fingerprint.absolutePathFor(copy);
  const outDir = path.join(process.cwd(), 'samples');
  fs.mkdirSync(outDir, { recursive: true });
  const dst = path.join(outDir, 'arabic-sample.pdf');
  fs.copyFileSync(abs, dst);
  console.log(JSON.stringify(
    {
      outputPath: dst,
      elapsedMs: elapsed,
      copyUuid: copy.copyUuid,
      generationId: generation.generationId,
      fileSha256: generation.fileSha256,
      signature: generation.signature,
    },
    null,
    2,
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
