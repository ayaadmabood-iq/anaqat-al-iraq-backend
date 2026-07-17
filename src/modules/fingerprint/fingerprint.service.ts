import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { Book, IssuedCopy, Order, User } from '@/database';

/**
 * §9 — protection layer.
 *
 * On approval of an order we do NOT keep a pre-baked per-buyer PDF. Instead we
 * take the master PDF, stamp every page with a visible watermark carrying the
 * buyer's identity, inject invisible metadata (buyer id, order id, UUID),
 * append a signature page, compute a SHA-256 hash of the produced bytes, then
 * persist a fingerprint registry row so the copy can be traced back to its
 * buyer during any forensic review.
 */
@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  constructor(
    @InjectRepository(IssuedCopy)
    private readonly copies: Repository<IssuedCopy>,
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
  ): string {
    return JSON.stringify({
      copy_uuid: copyUuid,
      order_id: order.id,
      order_number: order.orderNumber,
      book_id: book.id,
      book_slug: book.slug,
      buyer: {
        id: user.id,
        full_name: user.fullName,
        email: user.email,
        phone: user.phone,
        country: user.country,
        city: user.city,
      },
      issued_at: new Date().toISOString(),
      platform: 'منصة القراءة القصدية',
    });
  }

  /**
   * Regenerate a personalized PDF for the given order. Idempotent: if a copy
   * already exists it is overwritten and a fresh hash is recomputed. Returns
   * the persisted IssuedCopy row.
   */
  async issueCopyForOrder(
    order: Order,
    book: Book,
    user: User,
  ): Promise<IssuedCopy> {
    const existing = await this.copies.findOne({
      where: { orderId: order.id },
    });
    const copyUuid = existing?.copyUuid || randomUUID();

    const masterAbs = path.isAbsolute(book.masterPdfPath)
      ? book.masterPdfPath
      : path.join(this.booksDir(), book.masterPdfPath);
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

    // Visible watermark on every page (diagonal, low opacity so the reading
    // experience stays intact but the identity is always present).
    const pages = pdf.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const label = `${englishHint}  |  ${visibleText}`;
      const size = Math.max(10, Math.min(16, width / 60));
      page.drawText(label, {
        x: width * 0.08,
        y: height * 0.5,
        size,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.22,
        rotate: degrees(30),
      });
      page.drawText(`UUID: ${copyUuid}`, {
        x: 20,
        y: 12,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.6,
      });
      page.drawText(`Order: ${order.orderNumber}`, {
        x: width - 220,
        y: 12,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.6,
      });
    }

    // Metadata (signed by embedding the payload in Keywords + Subject).
    const hiddenPayload = this.buildHiddenPayload(user, order, book, copyUuid);
    pdf.setTitle(this.pickTitle(book));
    pdf.setAuthor(this.pickAuthor(book));
    pdf.setSubject('نسخة شخصية — منصة القراءة القصدية');
    pdf.setKeywords([`copy_uuid=${copyUuid}`, `order=${order.orderNumber}`]);
    pdf.setProducer('منصة القراءة القصدية');
    pdf.setCreator(user.email);
    pdf.setCreationDate(new Date());
    pdf.setModificationDate(new Date());

    // Append a trailer page carrying the full JSON fingerprint. Even if a
    // reader strips metadata, this page ties every downstream copy back to the
    // buyer — matching §9 "Metadata موقعة".
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
      `معرف النسخة (UUID): ${copyUuid}`,
      `تاريخ الإصدار: ${new Date().toISOString()}`,
      '',
      'Fingerprint payload (do not remove):',
    ];
    let y = th - 60;
    for (const l of lines) {
      trailer.drawText(l, { x: 40, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    }
    // Split the JSON payload across the remaining vertical space in ~90-char lines.
    const chunkSize = 90;
    for (let i = 0; i < hiddenPayload.length && y > 40; i += chunkSize) {
      trailer.drawText(hiddenPayload.slice(i, i + chunkSize), {
        x: 40,
        y,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 10;
    }
    // Border so the trailer page reads as an official annex, not stray content.
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

    const outDir = this.generatedDir();
    await fs.mkdir(outDir, { recursive: true });
    const outRelPath = path.join(
      book.slug,
      `${order.orderNumber}-${copyUuid}.pdf`,
    );
    const outAbsPath = path.join(outDir, outRelPath);
    await fs.mkdir(path.dirname(outAbsPath), { recursive: true });
    await fs.writeFile(outAbsPath, outBytes);

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
    row.generatedFilePath = outRelPath;
    row.fileSha256 = hash;
    row.visibleWatermark = visibleText;
    row.hiddenWatermarkPayload = hiddenPayload;
    const saved = await this.copies.save(row);

    this.logger.log(
      `issued copy ${copyUuid} for order ${order.orderNumber} (sha256=${hash.slice(0, 12)}…)`,
    );
    return saved;
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
    return path.join(this.generatedDir(), copy.generatedFilePath);
  }
}
