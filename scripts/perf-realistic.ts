#!/usr/bin/env ts-node
/**
 * Realistic perf sample.
 *
 * Builds a master PDF that has:
 *   • a cover page with a rasterised placeholder image (procedurally
 *     generated PNG so we don't ship a large binary in the repo)
 *   • mixed Latin / Arabic text
 *   • 300 body pages with two fonts (Helvetica for Latin, Amiri for Arabic)
 *
 * Then issues a personal copy via the real FingerprintService and reports
 * timings + peak resident-set size.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/perf-realistic.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { SigningService } from '@/modules/fingerprint/signing.service';
import { embedFonts } from '@/modules/fingerprint/font-registry';
import { shapeForRtl } from '@/modules/fingerprint/arabic-shape';
import type { Book, IssuedCopy, IssuedCopyGeneration, Order, User } from '@/database';

function stubRepo<T extends object>() {
  return {
    save: async (row: T) => {
      (row as { id?: string }).id ??= '00000000-0000-0000-0000-000000000001';
      return row;
    },
    create: (row: T) => row,
    findOne: async () => null,
  };
}

/** Tiny procedural PNG (256×256 gradient) — no external asset. */
function makeCoverPng(): Buffer {
  const W = 256, H = 256;
  const bytesPerRow = W * 3;
  const raw = Buffer.alloc((bytesPerRow + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[(bytesPerRow + 1) * y] = 0; // filter
    for (let x = 0; x < W; x++) {
      const off = (bytesPerRow + 1) * y + 1 + x * 3;
      raw[off] = Math.floor((x / W) * 255);
      raw[off + 1] = Math.floor((y / H) * 255);
      raw[off + 2] = 90;
    }
  }
  const zlib = require('zlib');
  const idat = zlib.deflateSync(raw);
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    // Compute CRC in pure JS.
    const table = (function () {
      const t = new Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })();
    let c = 0xffffffff;
    for (const b of Buffer.concat([typeBuf, data])) c = (table[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0;
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function buildRealisticMaster(pages: number, dst: string): Promise<number> {
  const pdf = await PDFDocument.create();
  const { latin, arabic } = await embedFonts(pdf);

  // Cover page.
  const png = await pdf.embedPng(makeCoverPng());
  const cover = pdf.addPage([595, 842]);
  cover.drawImage(png, { x: 40, y: 400, width: 300, height: 300 });
  cover.drawText(shapeForRtl('من طين ونفخة'), {
    x: 40, y: 350, size: 28, font: arabic, color: rgb(0.05, 0.05, 0.05),
  });
  cover.drawText('Of Clay and a Breath — Perf Realistic Sample', {
    x: 40, y: 320, size: 14, font: latin, color: rgb(0.15, 0.15, 0.15),
  });

  const arabicPara = shapeForRtl(
    'هذه فقرة اختبار أداء تحوي حروفاً عربية متصلة، مع علامات تشكيل خفيفة، ' +
      'ومزيجاً من الأرقام العربية والإنجليزية 2026-07-17، لقياس زمن التوليد ' +
      'الحقيقي على كتاب عربي بمحتوى مركّب.',
  );
  const latinPara =
    'This is a Latin paragraph interleaved with Arabic to measure realistic ' +
    'issue timings including image + two embedded fonts + shape/reorder cost.';

  for (let i = 0; i < pages; i++) {
    const p = pdf.addPage([595, 842]);
    let y = 790;
    for (let line = 0; line < 20; line++) {
      p.drawText(latinPara.slice(0, 100), { x: 40, y, size: 10, font: latin });
      y -= 14;
      p.drawText(arabicPara, { x: 555, y, size: 10, font: arabic });
      y -= 18;
    }
    p.drawText(`page ${i + 2} / ${pages + 1}`, { x: 40, y: 24, size: 8, font: latin });
  }
  const bytes = Buffer.from(await pdf.save());
  fs.writeFileSync(dst, bytes);
  return bytes.length;
}

async function main() {
  const PAGES = parseInt(process.env.PERF_PAGES || '300', 10);
  const rootStorage = fs.mkdtempSync('/tmp/qasdiya-realistic-');
  fs.mkdirSync(path.join(rootStorage, 'books', 'perf'), { recursive: true });
  fs.mkdirSync(path.join(rootStorage, 'generated'), { recursive: true });
  process.env.STORAGE_ROOT = rootStorage;
  process.env.COPY_SIGNING_KEY = 'ff'.repeat(32);

  const masterPath = path.join(rootStorage, 'books', 'perf', 'master.pdf');
  const t0 = Date.now();
  const masterSize = await buildRealisticMaster(PAGES, masterPath);
  const masterMs = Date.now() - t0;

  const signing = new SigningService();
  signing.load();
  const fingerprint = new FingerprintService(
    stubRepo<IssuedCopy>() as unknown as import('typeorm').Repository<IssuedCopy>,
    stubRepo<IssuedCopyGeneration>() as unknown as import('typeorm').Repository<IssuedCopyGeneration>,
    signing,
  );

  const book: Book = {
    id: 'bb', slug: 'perf-realistic',
    title: { ar: 'كتاب اختبار أداء واقعي' }, author: { ar: 'د. إياد محمد عبود' },
    description: {}, coverImagePath: null, masterPdfPath: 'perf/master.pdf',
    editionVersion: '1', samplePdfPath: null, pageCount: PAGES + 1,
    priceUsd: '10.00', priceIqd: null, keywords: [], categoryId: null,
    category: null, isFeatured: false, status: 'published',
    publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), orders: [],
  };
  const user: User = {
    id: 'uu', fullName: 'د. إياد محمد عبود', email: 'iyad@example.com',
    passwordHash: '', phone: '+964', country: 'العراق', city: 'بغداد',
    preferredLang: 'ar', role: 'customer', emailVerified: true, isActive: true,
    privacyAccepted: true, termsAccepted: true, acceptedAt: new Date(),
    tokenVersion: 1, mfaSecret: null, mfaEnabled: false, mfaRecoveryCodesHash: null,
    createdAt: new Date(), updatedAt: new Date(), orders: [], issuedCopies: [],
  };
  const order: Order = {
    id: 'oo', orderNumber: 'QSD-PERF-REALISTIC', userId: user.id, user,
    bookId: book.id, book, amount: '10.00', currency: 'USD', status: 'approved',
    agreementAccepted: true, agreementAcceptedAt: new Date(),
    rejectionReason: null, approvedAt: new Date(), approvedByUserId: null,
    fulfilledAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    transferProofs: [], issuedCopy: null,
  };

  const beforeMem = process.memoryUsage.rss();
  const t1 = Date.now();
  const { copy, generation } = await fingerprint.issueCopyForOrder(order, book, user, {
    reason: 'initial',
  });
  const issueMs = Date.now() - t1;
  const afterMem = process.memoryUsage.rss();

  const outPath = fingerprint.absolutePathFor(copy);
  const outSize = fs.statSync(outPath).size;
  const diskHash = createHash('sha256').update(fs.readFileSync(outPath)).digest('hex');

  const report = {
    pages: PAGES + 1,
    masterBuildMs: masterMs,
    masterSizeKB: (masterSize / 1024).toFixed(1),
    issueMs,
    pagesPerSecond: (((PAGES + 1) / issueMs) * 1000).toFixed(1),
    outSizeKB: (outSize / 1024).toFixed(1),
    peakRssMB: (Math.max(beforeMem, afterMem) / 1024 / 1024).toFixed(1),
    rssDeltaMB: ((afterMem - beforeMem) / 1024 / 1024).toFixed(1),
    diskSha256MatchesRecord: diskHash === generation.fileSha256,
    signatureValid: signing.verify(generation.signedPayload, generation.signature),
    outPath,
  };
  console.log(JSON.stringify(report, null, 2));

  const samples = path.join(process.cwd(), 'samples');
  fs.mkdirSync(samples, { recursive: true });
  fs.copyFileSync(outPath, path.join(samples, 'arabic-realistic-300.pdf'));
  fs.writeFileSync(path.join(samples, 'perf-realistic.json'), JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
