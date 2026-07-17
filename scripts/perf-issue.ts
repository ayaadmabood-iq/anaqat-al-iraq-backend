#!/usr/bin/env ts-node
/**
 * Preliminary performance test for the Digital Publishing Engine.
 *
 * Builds a synthetic Arabic master PDF of N pages, then issues a personal
 * copy through the real FingerprintService and reports:
 *   • master build time
 *   • per-issue elapsed
 *   • signature verify elapsed
 *   • pages/second
 *   • output size
 *   • output SHA-256 vs the recorded hash (byte-integrity round trip)
 *
 * Usage:
 *   PERF_PAGES=300 npx ts-node -r tsconfig-paths/register scripts/perf-issue.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { SigningService } from '@/modules/fingerprint/signing.service';
import { embedFonts } from '@/modules/fingerprint/font-registry';
import { shapeForRtl } from '@/modules/fingerprint/arabic-shape';
import { rgb } from 'pdf-lib';
import type { Book, IssuedCopy, IssuedCopyGeneration, Order, User } from '@/database';

function stubRepo<T extends object>(): {
  save: (row: T) => Promise<T>;
  create: (row: T) => T;
  findOne: () => Promise<null>;
} {
  return {
    save: async (row) => {
      (row as { id?: string }).id ??= '00000000-0000-0000-0000-000000000001';
      return row;
    },
    create: (row) => row,
    findOne: async () => null,
  };
}

async function buildArabicMaster(pages: number, dst: string): Promise<void> {
  const pdf = await PDFDocument.create();
  const { arabic } = await embedFonts(pdf);
  const paragraph = shapeForRtl(
    'هذه صفحة اختبار أداء لمنصة القراءة القصدية. يُعاد إنتاج نفس الفقرة عبر مئات الصفحات ' +
      'لقياس زمن التوليد والتوقيع والتنزيل مع نص عربي حقيقي، ولإثبات أن العلامات المضمَّنة ' +
      'لا تكسر تدفق النص العربي عبر الصفحات.',
  );
  for (let i = 0; i < pages; i++) {
    const p = pdf.addPage([595, 842]);
    let y = 800;
    for (let line = 0; line < 30; line++) {
      p.drawText(paragraph, {
        x: 555,
        y,
        size: 10,
        font: arabic,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 24;
    }
    p.drawText(`page ${i + 1} / ${pages}`, {
      x: 40,
      y: 24,
      size: 8,
      font: arabic,
    });
  }
  const bytes = Buffer.from(await pdf.save());
  fs.writeFileSync(dst, bytes);
}

async function main() {
  const PAGES = parseInt(process.env.PERF_PAGES || '300', 10);
  const rootStorage = fs.mkdtempSync('/tmp/qasdiya-perf-');
  fs.mkdirSync(path.join(rootStorage, 'books', 'perf'), { recursive: true });
  fs.mkdirSync(path.join(rootStorage, 'generated'), { recursive: true });
  process.env.STORAGE_ROOT = rootStorage;
  process.env.COPY_SIGNING_KEY = 'ff'.repeat(32);

  const masterPath = path.join(rootStorage, 'books', 'perf', 'master.pdf');
  const t0 = Date.now();
  await buildArabicMaster(PAGES, masterPath);
  const masterMs = Date.now() - t0;
  const masterSize = fs.statSync(masterPath).size;

  const signing = new SigningService();
  signing.load();
  const fingerprint = new FingerprintService(
    stubRepo<IssuedCopy>() as unknown as import('typeorm').Repository<IssuedCopy>,
    stubRepo<IssuedCopyGeneration>() as unknown as import('typeorm').Repository<IssuedCopyGeneration>,
    signing,
  );

  const book: Book = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    slug: 'perf',
    title: { ar: 'كتاب اختبار الأداء' },
    author: { ar: 'د. إياد محمد عبود' },
    description: {},
    coverImagePath: null,
    masterPdfPath: 'perf/master.pdf',
    editionVersion: '1',
    samplePdfPath: null,
    pageCount: PAGES,
    priceUsd: '10.00',
    priceIqd: null,
    keywords: [],
    categoryId: null,
    category: null,
    isFeatured: false,
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
    phone: '+964',
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
    orderNumber: 'QSD-PERF-000001',
    userId: user.id,
    user,
    bookId: book.id,
    book,
    amount: '10.00',
    currency: 'USD',
    status: 'approved',
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

  const t1 = Date.now();
  const { copy, generation } = await fingerprint.issueCopyForOrder(order, book, user, {
    reason: 'initial',
  });
  const issueMs = Date.now() - t1;

  const outPath = fingerprint.absolutePathFor(copy);
  const outSize = fs.statSync(outPath).size;
  const t2 = Date.now();
  const diskHash = createHash('sha256').update(fs.readFileSync(outPath)).digest('hex');
  const hashMs = Date.now() - t2;

  const t3 = Date.now();
  const sigValid = signing.verify(generation.signedPayload, generation.signature);
  const verifyMs = Date.now() - t3;

  const samples = path.join(process.cwd(), 'samples');
  fs.mkdirSync(samples, { recursive: true });
  if (PAGES <= 20) {
    fs.copyFileSync(outPath, path.join(samples, `arabic-perf-${PAGES}.pdf`));
  }

  console.log(JSON.stringify(
    {
      pages: PAGES,
      masterBuildMs: masterMs,
      masterSizeKB: (masterSize / 1024).toFixed(1),
      issueMs,
      pagesPerSecond: ((PAGES / issueMs) * 1000).toFixed(1),
      diskHashMs: hashMs,
      diskSha256MatchesRecord: diskHash === generation.fileSha256,
      signatureValid: sigValid,
      verifyMs,
      outSizeKB: (outSize / 1024).toFixed(1),
      outPath,
    },
    null,
    2,
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
