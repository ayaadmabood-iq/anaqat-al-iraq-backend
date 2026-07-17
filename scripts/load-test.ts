#!/usr/bin/env ts-node
/**
 * Load test — fires N concurrent issue+verify runs and reports:
 *   • per-request timings (min/p50/p95/p99/max)
 *   • throughput (issues/s)
 *   • peak RSS
 *   • failure rate
 *
 * Uses the real FingerprintService against a synthetic master PDF so the
 * numbers reflect the actual code path (font embed + shape + reorder +
 * multi-page loop + sign + write to disk).
 *
 * Usage:
 *   PERF_PAGES=30 LOAD_N=50 LOAD_CONCURRENCY=10 npx ts-node --transpile-only \
 *     -r tsconfig-paths/register scripts/load-test.ts
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { SigningService } from '@/modules/fingerprint/signing.service';
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

async function buildSyntheticMaster(pages: number, dst: string): Promise<void> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = pdf.addPage([595, 842]);
    p.drawText(`Load test master page ${i + 1}`, { x: 40, y: 400, size: 16, font: helv });
  }
  fs.writeFileSync(dst, Buffer.from(await pdf.save()));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const PAGES = parseInt(process.env.PERF_PAGES || '30', 10);
  const TOTAL = parseInt(process.env.LOAD_N || '50', 10);
  const CONCURRENCY = parseInt(process.env.LOAD_CONCURRENCY || '10', 10);

  const rootStorage = fs.mkdtempSync('/tmp/qasdiya-load-');
  fs.mkdirSync(path.join(rootStorage, 'books', 'load'), { recursive: true });
  fs.mkdirSync(path.join(rootStorage, 'generated'), { recursive: true });
  process.env.STORAGE_ROOT = rootStorage;
  process.env.COPY_SIGNING_KEY = 'ff'.repeat(32);

  await buildSyntheticMaster(PAGES, path.join(rootStorage, 'books', 'load', 'master.pdf'));

  const signing = new SigningService();
  signing.load();
  const fingerprint = new FingerprintService(
    stubRepo<IssuedCopy>() as unknown as import('typeorm').Repository<IssuedCopy>,
    stubRepo<IssuedCopyGeneration>() as unknown as import('typeorm').Repository<IssuedCopyGeneration>,
    signing,
  );
  const book: Book = {
    id: 'bb', slug: 'load', title: { ar: 'حمل' }, author: { ar: 'م' },
    description: {}, coverImagePath: null, masterPdfPath: 'load/master.pdf',
    editionVersion: '1', samplePdfPath: null, pageCount: PAGES,
    priceUsd: '1', priceIqd: null, keywords: [], categoryId: null, category: null,
    isFeatured: false, status: 'published', publishedAt: new Date(),
    createdAt: new Date(), updatedAt: new Date(), orders: [],
  };
  const baseUser = (i: number): User => ({
    id: `u-${i}`, fullName: `Buyer ${i}`, email: `b${i}@example.com`,
    passwordHash: '', phone: null, country: null, city: null,
    preferredLang: 'ar', role: 'customer', emailVerified: true, isActive: true,
    privacyAccepted: true, termsAccepted: true, acceptedAt: new Date(),
    tokenVersion: 1, mfaSecret: null, mfaEnabled: false, mfaRecoveryCodesHash: null,
    createdAt: new Date(), updatedAt: new Date(), orders: [], issuedCopies: [],
  });
  const baseOrder = (i: number, user: User): Order => ({
    id: `o-${i}`, orderNumber: `QSD-LOAD-${String(i).padStart(6, '0')}`,
    userId: user.id, user, bookId: book.id, book, amount: '1', currency: 'USD',
    status: 'approved', agreementAccepted: true, agreementAcceptedAt: new Date(),
    rejectionReason: null, approvedAt: new Date(), approvedByUserId: null,
    fulfilledAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    transferProofs: [], issuedCopy: null,
  });

  const timings: number[] = [];
  let failures = 0;
  let peakRss = process.memoryUsage.rss();
  const startAll = Date.now();

  let inflight = 0;
  let next = 0;
  await new Promise<void>((resolve) => {
    const kickOne = () => {
      if (next >= TOTAL && inflight === 0) return resolve();
      while (inflight < CONCURRENCY && next < TOTAL) {
        const i = next++;
        inflight++;
        const started = Date.now();
        const user = baseUser(i);
        const order = baseOrder(i, user);
        fingerprint
          .issueCopyForOrder(order, book, user, { reason: 'initial' })
          .then(({ generation }) => {
            const ok = signing.verify(generation.signedPayload, generation.signature);
            if (!ok) failures++;
            timings.push(Date.now() - started);
            peakRss = Math.max(peakRss, process.memoryUsage.rss());
          })
          .catch(() => { failures++; })
          .finally(() => { inflight--; kickOne(); });
      }
    };
    kickOne();
  });

  const totalMs = Date.now() - startAll;
  const sorted = [...timings].sort((a, b) => a - b);
  const report = {
    settings: { pagesPerCopy: PAGES, total: TOTAL, concurrency: CONCURRENCY },
    wallClockMs: totalMs,
    throughputPerSec: (TOTAL / (totalMs / 1000)).toFixed(2),
    failures,
    failureRate: (failures / TOTAL).toFixed(3),
    latencyMs: {
      min: sorted[0] ?? 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? 0,
      avg: Math.round(timings.reduce((a, b) => a + b, 0) / (timings.length || 1)),
    },
    peakRssMB: (peakRss / 1024 / 1024).toFixed(1),
  };
  console.log(JSON.stringify(report, null, 2));

  const samples = path.join(process.cwd(), 'samples');
  fs.mkdirSync(samples, { recursive: true });
  fs.writeFileSync(path.join(samples, 'load-report.json'), JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
