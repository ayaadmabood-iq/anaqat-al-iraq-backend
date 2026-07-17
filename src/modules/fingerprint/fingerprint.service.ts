import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

/**
 * StandardFonts.Helvetica uses WinAnsi encoding and cannot render Arabic
 * script. For on-page text we replace any character outside WinAnsi with '?'
 * so the PDF still generates; the full Arabic identity remains inside PDF
 * metadata (UTF-16) and the JSON fingerprint payload. Adding a proper Arabic
 * font (CID-embedded) is a v2 line item — the fingerprint anchor is the
 * detached HMAC signature stored in the DB, not the rendered footer.
 */
function toWinAnsiSafe(s: string): string {
  return (s || '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}
import {
  Book,
  IssuedCopy,
  IssuedCopyGeneration,
  Order,
  User,
} from '@/database';
import { safeJoin } from '@/modules/common/safe-path';
import { SigningService, SigningPayload } from './signing.service';

/**
 * Digital Publishing Engine (IRPB file 4).
 *
 * These are identification, tracking and deterrence mechanisms — NOT
 * cryptographic prevention. A determined attacker can strip any single layer;
 * the value is redundancy plus the offline detached signature stored in the
 * database so a leaked copy can still be tied to its buyer.
 *
 *   • Visible bottom-of-page footer with buyer + order#  → cropping removes it
 *   • Diagonal semi-transparent watermark                → OCR/redaction can hide it
 *   • UUID + edition markers in the page corners         → cropping removes them
 *   • Signed metadata (Title/Author/Subject/Keywords)    → metadata edit strips them
 *   • Trailer certificate page with the full payload     → last-page removal strips it
 *   • Detached HMAC signature stored in the DB           → cannot be removed from file,
 *                                                          because it lives outside it
 *
 * The last item is the anchor. Every generation persists to
 * `issued_copy_generations` with a unique `generationId` and a fresh SHA-256,
 * and the signing payload is HMAC-signed by SigningService. Verification is
 * done offline via `bin/verify-copy.js` — the signature does not depend on
 * anything embedded in the leaked file, only on the copyUuid + generationId
 * that appear on the certificate page (and, redundantly, in metadata + every
 * page corner).
 */
@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  constructor(
    @InjectRepository(IssuedCopy)
    private readonly copies: Repository<IssuedCopy>,
    @InjectRepository(IssuedCopyGeneration)
    private readonly generations: Repository<IssuedCopyGeneration>,
    private readonly signing: SigningService,
  ) {}

  private storageRoot(): string {
    return process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');
  }

  private booksDir(): string {
    return (
      process.env.BOOKS_SOURCE_DIR ||
      path.join(this.storageRoot(), 'books')
    );
  }

  private generatedDir(): string {
    return (
      process.env.GENERATED_DIR ||
      path.join(this.storageRoot(), 'generated')
    );
  }

  private buildVisibleWatermark(user: User, orderNumber: string): string {
    const arText =
      process.env.WATERMARK_TEXT_AR ||
      'هذه النسخة شخصية — لا يجوز إعادة نشرها';
    return `${arText} — ${user.fullName} <${user.email}> — طلب ${orderNumber}`;
  }

  private buildHiddenPayload(
    user: User,
    order: Order,
    book: Book,
    copyUuid: string,
    generationId: string,
    generationNumber: number,
    issuedAtISO: string,
  ): string {
    return JSON.stringify({
      copy_uuid: copyUuid,
      generation_id: generationId,
      generation_number: generationNumber,
      order_id: order.id,
      order_number: order.orderNumber,
      book_id: book.id,
      book_slug: book.slug,
      book_edition: book.editionVersion,
      buyer: {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        phone: user.phone,
        country: user.country,
        city: user.city,
      },
      issued_at: issuedAtISO,
      platform: 'منصة القراءة القصدية',
    });
  }

  /**
   * Produce a personalized PDF for the given order.
   *
   * @param opts.reason 'initial' on approval, 'reissue' when the buyer
   *                    requests a fresh file, 'admin_reissue' when an admin
   *                    forces one. Every call appends a new row to
   *                    `issued_copy_generations` — the previous generation
   *                    files stay on disk and in the DB for forensic
   *                    comparison.
   */
  async issueCopyForOrder(
    order: Order,
    book: Book,
    user: User,
    opts: {
      reason: 'initial' | 'reissue' | 'admin_reissue';
      triggeredByUserId?: string;
    },
  ): Promise<{ copy: IssuedCopy; generation: IssuedCopyGeneration }> {
    const existing = await this.copies.findOne({
      where: { orderId: order.id },
    });
    const copyUuid = existing?.copyUuid || randomUUID();
    const generationId = randomUUID();
    const generationNumber = (existing?.currentGenerationNumber ?? 0) + 1;

    const masterAbs = safeJoin(this.booksDir(), book.masterPdfPath);
    let masterBytes: Buffer;
    try {
      masterBytes = await fs.readFile(masterAbs);
    } catch (err) {
      throw new NotFoundException(
        `master PDF not found at ${masterAbs}: ${(err as Error).message}`,
      );
    }

    const pdf = await PDFDocument.load(masterBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const visibleText = this.buildVisibleWatermark(user, order.orderNumber);
    const englishHint =
      process.env.WATERMARK_TEXT_EN ||
      'Personal copy — redistribution is prohibited';
    const issuedAt = new Date();

    const pages = pdf.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();

      const diagonal = `${englishHint}  |  ${visibleText}`;
      const diagSize = Math.max(10, Math.min(16, width / 60));
      page.drawText(toWinAnsiSafe(diagonal), {
        x: width * 0.08,
        y: height * 0.5,
        size: diagSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.22,
        rotate: degrees(30),
      });

      const footer = `${user.fullName} | ${user.email} | order ${order.orderNumber}`;
      page.drawText(toWinAnsiSafe(footer), {
        x: 40,
        y: 24,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
        opacity: 0.85,
      });

      page.drawText(`UUID: ${copyUuid}  gen:${generationNumber}`, {
        x: 20,
        y: 12,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.6,
      });
      page.drawText(
        `ed.${book.editionVersion} · ${order.orderNumber}`,
        {
          x: width - 220,
          y: 12,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.6,
        },
      );
    }

    const hiddenPayload = this.buildHiddenPayload(
      user,
      order,
      book,
      copyUuid,
      generationId,
      generationNumber,
      issuedAt.toISOString(),
    );
    pdf.setTitle(this.pickTitle(book));
    pdf.setAuthor(this.pickAuthor(book));
    pdf.setSubject('نسخة شخصية — منصة القراءة القصدية');
    pdf.setKeywords([
      `copy_uuid=${copyUuid}`,
      `generation_id=${generationId}`,
      `generation_number=${generationNumber}`,
      `order=${order.orderNumber}`,
      `edition=${book.editionVersion}`,
    ]);
    pdf.setProducer('منصة القراءة القصدية');
    pdf.setCreator(user.email);
    pdf.setCreationDate(issuedAt);
    pdf.setModificationDate(issuedAt);

    // Certificate trailer page.
    const trailer = pdf.addPage();
    const { width: tw, height: th } = trailer.getSize();
    const lines = [
      'شهادة نسخة شخصية',
      'Personal Copy Certificate',
      '',
      `الاسم: ${user.fullName}`,
      `البريد: ${user.email}`,
      `الهاتف: ${user.phone ?? '-'}`,
      `الدولة/المدينة: ${user.country ?? '-'} / ${user.city ?? '-'}`,
      `رقم الطلب: ${order.orderNumber}`,
      `إصدار الكتاب: ${book.editionVersion}`,
      `معرف النسخة (UUID): ${copyUuid}`,
      `رقم التوليد: ${generationNumber}   (generation_id: ${generationId})`,
      `تاريخ الإصدار: ${issuedAt.toISOString()}`,
      opts.reason !== 'initial'
        ? `سبب الإصدار: ${opts.reason === 'reissue' ? 'إعادة إنشاء بطلب المشتري' : 'إعادة إنشاء بأمر إداري'}`
        : '',
      '',
      'Fingerprint payload (do not remove):',
    ];
    let y = th - 60;
    for (const l of lines) {
      trailer.drawText(toWinAnsiSafe(l), {
        x: 40,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 16;
    }
    const chunkSize = 90;
    for (let i = 0; i < hiddenPayload.length && y > 40; i += chunkSize) {
      trailer.drawText(toWinAnsiSafe(hiddenPayload.slice(i, i + chunkSize)), {
        x: 40,
        y,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 10;
    }
    trailer.drawRectangle({
      x: 20,
      y: 20,
      width: tw - 40,
      height: th - 40,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.6,
    });

    const outBytes = Buffer.from(await pdf.save({ useObjectStreams: true }));
    const hash = createHash('sha256').update(outBytes).digest('hex');

    const signingPayload: SigningPayload = {
      copyUuid,
      generationId,
      generationNumber,
      orderNumber: order.orderNumber,
      bookId: book.id,
      bookEdition: book.editionVersion,
      buyerUserId: user.id,
      fileSha256: hash,
      issuedAt: issuedAt.toISOString(),
    };
    const signature = this.signing.sign(signingPayload);

    // Filename embeds the generation number so previous generations survive
    // side by side on disk — never overwrite an older file.
    const outRel = path.join(
      book.slug,
      `${order.orderNumber}-${copyUuid}-g${generationNumber}.pdf`,
    );
    const outAbs = safeJoin(this.generatedDir(), outRel);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, outBytes);

    // Persist the parent copy first so we have an id for the generation FK.
    const row =
      existing ??
      this.copies.create({
        copyUuid,
        orderId: order.id,
        userId: user.id,
        bookId: book.id,
      });
    row.buyerFullName = user.fullName;
    row.buyerEmail = user.email;
    row.buyerPhone = user.phone;
    row.buyerCountry = user.country;
    row.buyerCity = user.city;
    row.generatedFilePath = outRel;
    row.fileSha256 = hash;
    row.currentGenerationNumber = generationNumber;
    row.currentGenerationId = generationId;
    row.visibleWatermark = visibleText;
    row.hiddenWatermarkPayload = hiddenPayload;
    const savedCopy = await this.copies.save(row);

    const generation = await this.generations.save(
      this.generations.create({
        issuedCopyId: savedCopy.id,
        generationId,
        generationNumber,
        filePath: outRel,
        fileSha256: hash,
        signedPayload: signingPayload,
        signature,
        reason: opts.reason,
        triggeredByUserId: opts.triggeredByUserId ?? null,
      }),
    );

    this.logger.log(
      `${opts.reason} copy ${copyUuid} gen ${generationNumber} for order ${order.orderNumber} (sha256=${hash.slice(0, 12)}…)`,
    );
    return { copy: savedCopy, generation };
  }

  private pickTitle(book: Book): string {
    const t = book.title || {};
    return t.ar || t.en || Object.values(t)[0] || book.slug;
  }

  private pickAuthor(book: Book): string {
    const a = book.author || {};
    return a.ar || a.en || Object.values(a)[0] || '';
  }

  absolutePathFor(copy: IssuedCopy): string {
    return safeJoin(this.generatedDir(), copy.generatedFilePath);
  }

  absolutePathForGeneration(generation: IssuedCopyGeneration): string {
    return safeJoin(this.generatedDir(), generation.filePath);
  }
}
