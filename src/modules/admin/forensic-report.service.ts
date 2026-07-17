import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  IssuedCopy,
  IssuedCopyGeneration,
  User,
} from '@/database';
import { SigningService } from '@/modules/fingerprint/signing.service';

export interface ForensicReport {
  reportNumber: string;
  reportSha256: string;
  generatedAt: string;
  issuer: { userId: string; email: string; role: string };
  disclaimer: string;
  identity: {
    copyUuid: string;
    issuedAt: Date | null;
    currentGenerationId: string | null;
    currentGenerationNumber: number;
    currentFileSha256: string;
    visibleWatermark: string;
  };
  order: unknown;
  book: unknown;
  buyerSnapshot: unknown;
  currentBuyerAccount: unknown;
  downloadCount: number;
  downloads: unknown[];
  generations: Array<{
    generationId: string;
    generationNumber: number;
    reason: string;
    createdAt: Date;
    filePath: string;
    fileSha256: string;
    signedPayload: unknown;
    signature: unknown;
    signatureValid: boolean;
  }>;
  hiddenWatermarkPayload: unknown;
}

@Injectable()
export class ForensicReportService {
  constructor(
    @InjectRepository(IssuedCopy) private readonly copies: Repository<IssuedCopy>,
    @InjectRepository(IssuedCopyGeneration)
    private readonly generations: Repository<IssuedCopyGeneration>,
    private readonly signing: SigningService,
  ) {}

  async build(copyUuid: string, issuer: User): Promise<ForensicReport> {
    const copy = await this.copies.findOne({
      where: { copyUuid },
      relations: ['user', 'book', 'order', 'downloads'],
    });
    if (!copy) throw new NotFoundException('لا توجد نسخة بهذا المعرّف');
    const generations = await this.generations.find({
      where: { issuedCopyId: copy.id },
      order: { generationNumber: 'ASC' },
    });

    const downloads = (copy.downloads ?? [])
      .sort((a, b) => b.downloadedAt.getTime() - a.downloadedAt.getTime())
      .map((d) => ({
        downloadedAt: d.downloadedAt,
        ip: d.ipAddress,
        browser: d.browser,
        os: d.os,
        userAgent: d.userAgent,
      }));

    const generationsForReport = generations.map((g) => {
      const valid = this.signing.verify(
        g.signedPayload,
        g.signature as {
          algo: 'HMAC-SHA256';
          keyId: string;
          signedAt: string;
          value: string;
        },
      );
      return {
        generationId: g.generationId,
        generationNumber: g.generationNumber,
        reason: g.reason,
        createdAt: g.createdAt,
        filePath: g.filePath,
        fileSha256: g.fileSha256,
        signedPayload: g.signedPayload,
        signature: g.signature,
        signatureValid: valid,
      };
    });

    // Build the report body, then stamp it with a report number and a hash
    // computed over the body (so the report itself is tamper-evident).
    const body: Omit<ForensicReport, 'reportNumber' | 'reportSha256'> = {
      generatedAt: new Date().toISOString(),
      issuer: { userId: issuer.id, email: issuer.email, role: issuer.role },
      disclaimer:
        'تقرير فني داخلي — للاسترشاد والتحقيق فقط. لا يُعد وحده دليلاً قانونياً قاطعاً.',
      identity: {
        copyUuid: copy.copyUuid,
        issuedAt: copy.issuedAt,
        currentGenerationId: copy.currentGenerationId,
        currentGenerationNumber: copy.currentGenerationNumber,
        currentFileSha256: copy.fileSha256,
        visibleWatermark: copy.visibleWatermark,
      },
      order: copy.order && {
        id: copy.order.id,
        orderNumber: copy.order.orderNumber,
        status: copy.order.status,
        approvedAt: copy.order.approvedAt,
        fulfilledAt: copy.order.fulfilledAt,
      },
      book: copy.book && {
        id: copy.book.id,
        slug: copy.book.slug,
        title: copy.book.title,
        editionVersion: copy.book.editionVersion,
      },
      buyerSnapshot: {
        fullName: copy.buyerFullName,
        email: copy.buyerEmail,
        phone: copy.buyerPhone,
        country: copy.buyerCountry,
        city: copy.buyerCity,
      },
      currentBuyerAccount: copy.user && {
        id: copy.user.id,
        fullName: copy.user.fullName,
        email: copy.user.email,
        role: copy.user.role,
        isActive: copy.user.isActive,
      },
      downloadCount: downloads.length,
      downloads,
      generations: generationsForReport,
      hiddenWatermarkPayload: (() => {
        try {
          return JSON.parse(copy.hiddenWatermarkPayload);
        } catch {
          return copy.hiddenWatermarkPayload;
        }
      })(),
    };

    const reportNumber = `FR-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
    const canonical = JSON.stringify(body);
    const reportSha256 = createHash('sha256').update(canonical).digest('hex');
    return { reportNumber, reportSha256, ...body };
  }

  async buildPdf(report: ForensicReport): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage();
    const { width, height } = page.getSize();

    const drawLine = (
      y: number,
      text: string,
      opts: { size?: number; boldFont?: boolean } = {},
    ) => {
      page.drawText(text, {
        x: 40,
        y,
        size: opts.size ?? 10,
        font: opts.boldFont ? bold : font,
        color: rgb(0.12, 0.12, 0.12),
      });
    };

    let y = height - 60;
    drawLine(y, 'Forensic Report', { size: 16, boldFont: true });
    y -= 22;
    drawLine(y, `Report No. ${report.reportNumber}`, { boldFont: true });
    y -= 14;
    drawLine(y, `Generated at: ${report.generatedAt}`);
    y -= 14;
    drawLine(y, `Issuer: ${report.issuer.email} (${report.issuer.role})`);
    y -= 14;
    drawLine(y, `Report SHA-256: ${report.reportSha256}`);
    y -= 20;
    // The Arabic disclaimer is preserved in the JSON body; on-page we render
    // an ASCII equivalent because the built-in font is WinAnsi-only.
    drawLine(
      y,
      'Internal audit report — for investigation only, not standalone legal proof.',
      { size: 8 },
    );
    y -= 20;

    drawLine(y, 'Identity', { boldFont: true, size: 12 });
    y -= 16;
    drawLine(y, `copy_uuid = ${report.identity.copyUuid}`);
    y -= 12;
    drawLine(
      y,
      `current generation ${report.identity.currentGenerationNumber} · id ${report.identity.currentGenerationId}`,
    );
    y -= 12;
    drawLine(y, `current SHA-256: ${report.identity.currentFileSha256}`);
    y -= 20;

    drawLine(y, 'Generations', { boldFont: true, size: 12 });
    y -= 14;
    for (const g of report.generations) {
      if (y < 100) break;
      drawLine(
        y,
        `#${g.generationNumber}  ${g.generationId}  ${g.reason}  ${g.createdAt.toISOString?.() ?? g.createdAt}`,
        { size: 9 },
      );
      y -= 10;
      drawLine(
        y,
        `   sha256=${g.fileSha256}  sig=${g.signatureValid ? 'VALID' : 'INVALID'}`,
        { size: 9 },
      );
      y -= 12;
    }

    y -= 8;
    drawLine(y, `Downloads: ${report.downloadCount}`, { boldFont: true, size: 12 });
    y -= 14;
    for (const d of report.downloads.slice(0, 10) as Array<{
      downloadedAt: Date | string;
      ip: string | null;
      browser: string | null;
      os: string | null;
    }>) {
      if (y < 60) break;
      const ts =
        typeof d.downloadedAt === 'string'
          ? d.downloadedAt
          : d.downloadedAt.toISOString();
      drawLine(
        y,
        `${ts}  ip=${d.ip ?? '-'}  browser=${d.browser ?? '-'}  os=${d.os ?? '-'}`,
        { size: 9 },
      );
      y -= 11;
    }

    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.6,
    });

    return Buffer.from(await pdf.save());
  }
}
