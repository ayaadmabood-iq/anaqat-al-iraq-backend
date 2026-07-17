import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Book,
  DownloadLog,
  IssuedCopy,
  Order,
  User,
} from '@/database';

/**
 * Aggregate dashboard queries used only from the admin panel: sales report,
 * customer & copy lookups by UUID, and audit-friendly summaries.
 * IRPB files 2 §12, 4 §9-10.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(IssuedCopy) private readonly copies: Repository<IssuedCopy>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Book) private readonly books: Repository<Book>,
    @InjectRepository(DownloadLog) private readonly downloads: Repository<DownloadLog>,
  ) {}

  async summary() {
    const [users, books, ordersByStatus, issued, downloads] = await Promise.all([
      this.users.count(),
      this.books.count(),
      this.orders
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.status')
        .getRawMany<{ status: string; count: string }>(),
      this.copies.count(),
      this.downloads.count(),
    ]);
    const revenue = await this.orders
      .createQueryBuilder('o')
      .select("COALESCE(SUM(o.amount::numeric), 0)", 'total')
      .addSelect('o.currency', 'currency')
      .where("o.status = 'fulfilled'")
      .groupBy('o.currency')
      .getRawMany<{ total: string; currency: string }>();
    return {
      users,
      books,
      orders: ordersByStatus.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = parseInt(r.count, 10);
        return acc;
      }, {}),
      issuedCopies: issued,
      totalDownloads: downloads,
      fulfilledRevenue: revenue.map((r) => ({
        currency: r.currency,
        total: r.total,
      })),
    };
  }

  async salesReport(fromISO?: string, toISO?: string) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.book', 'b')
      .leftJoinAndSelect('o.user', 'u')
      .where("o.status = 'fulfilled'");
    if (fromISO) qb.andWhere('o.fulfilledAt >= :from', { from: fromISO });
    if (toISO) qb.andWhere('o.fulfilledAt <= :to', { to: toISO });
    const rows = await qb.orderBy('o.fulfilledAt', 'DESC').getMany();
    return rows.map((o) => ({
      orderNumber: o.orderNumber,
      fulfilledAt: o.fulfilledAt,
      amount: o.amount,
      currency: o.currency,
      book: { id: o.book.id, slug: o.book.slug, title: o.book.title },
      buyer: { id: o.user.id, fullName: o.user.fullName, email: o.user.email },
    }));
  }

  /**
   * IRPB file 2 §12 — "الكتب الأكثر مبيعاً".
   */
  async bestSellingBooks(limit = 10) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .leftJoin('o.book', 'b')
      .select('b.id', 'bookId')
      .addSelect('b.slug', 'slug')
      .addSelect('b.title', 'title')
      .addSelect('COUNT(*)', 'fulfilledCount')
      .addSelect("COALESCE(SUM(o.amount::numeric), 0)", 'revenue')
      .where("o.status = 'fulfilled'")
      .groupBy('b.id')
      .addGroupBy('b.slug')
      .addGroupBy('b.title')
      .orderBy('"fulfilledCount"', 'DESC')
      .limit(Math.min(100, Math.max(1, limit)))
      .getRawMany();
    return rows;
  }

  /**
   * IRPB file 2 §12 — "الطلبات المعلقة".
   */
  async pendingOrders() {
    return this.orders.find({
      where: [
        { status: 'awaiting_review' },
        { status: 'pending_payment' },
        { status: 'rejected' },
      ],
      order: { updatedAt: 'DESC' },
      relations: ['user', 'book', 'transferProofs'],
    });
  }

  async lookupByUuid(copyUuid: string) {
    const copy = await this.copies.findOne({
      where: { copyUuid },
      relations: ['user', 'book', 'order', 'downloads'],
    });
    if (!copy) throw new NotFoundException('لا توجد نسخة بهذا المعرّف');
    return {
      copyUuid: copy.copyUuid,
      issuedAt: copy.issuedAt,
      fileSha256: copy.fileSha256,
      visibleWatermark: copy.visibleWatermark,
      order: copy.order && {
        id: copy.order.id,
        orderNumber: copy.order.orderNumber,
        status: copy.order.status,
        approvedAt: copy.order.approvedAt,
      },
      book: copy.book && {
        id: copy.book.id,
        slug: copy.book.slug,
        title: copy.book.title,
      },
      buyer: {
        id: copy.user.id,
        fullName: copy.user.fullName,
        email: copy.user.email,
        phone: copy.user.phone,
        country: copy.user.country,
        city: copy.user.city,
      },
      downloadCount: copy.downloads?.length ?? 0,
    };
  }

  /**
   * IRPB file 4 §9 — search issued copies by buyer name / email / order#.
   */
  async searchCopies(opts: { buyer?: string; orderNumber?: string }) {
    if (!opts.buyer && !opts.orderNumber) {
      throw new BadRequestException('يرجى تحديد اسم المشتري أو رقم الطلب');
    }
    const qb = this.copies
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.book', 'b')
      .leftJoinAndSelect('c.order', 'o')
      .leftJoinAndSelect('c.user', 'u')
      .orderBy('c.issuedAt', 'DESC');
    if (opts.buyer) {
      const term = `%${opts.buyer.trim()}%`;
      qb.andWhere(
        `(c.buyerFullName ILIKE :t OR c.buyerEmail ILIKE :t OR u.fullName ILIKE :t OR u.email ILIKE :t)`,
        { t: term },
      );
    }
    if (opts.orderNumber) {
      qb.andWhere('o.orderNumber ILIKE :on', {
        on: `%${opts.orderNumber.trim()}%`,
      });
    }
    const rows = await qb.limit(200).getMany();
    return rows.map((c) => ({
      copyUuid: c.copyUuid,
      issuedAt: c.issuedAt,
      fileSha256: c.fileSha256,
      order: c.order && {
        id: c.order.id,
        orderNumber: c.order.orderNumber,
        status: c.order.status,
      },
      book: c.book && { id: c.book.id, slug: c.book.slug, title: c.book.title },
      buyer: {
        fullName: c.buyerFullName,
        email: c.buyerEmail,
        country: c.buyerCountry,
        city: c.buyerCity,
      },
    }));
  }

  /**
   * IRPB file 4 §10 — forensic report for a leaked copy. Aggregates the
   * identity, integrity, order, and download-trace evidence for a single
   * UUID. The report is intended for internal investigations and is not by
   * itself a legal proof.
   */
  async forensicReport(copyUuid: string) {
    const copy = await this.copies.findOne({
      where: { copyUuid },
      relations: ['user', 'book', 'order', 'downloads'],
    });
    if (!copy) throw new NotFoundException('لا توجد نسخة بهذا المعرّف');
    const downloads = (copy.downloads ?? [])
      .sort((a, b) => b.downloadedAt.getTime() - a.downloadedAt.getTime())
      .map((d) => ({
        downloadedAt: d.downloadedAt,
        ip: d.ipAddress,
        browser: d.browser,
        os: d.os,
        userAgent: d.userAgent,
      }));
    return {
      generatedAt: new Date(),
      disclaimer:
        'تقرير فني داخلي — للاسترشاد والتحقيق فقط. لا يُعد وحده دليلاً قانونياً قاطعاً.',
      identity: {
        copyUuid: copy.copyUuid,
        issuedAt: copy.issuedAt,
        fileSha256: copy.fileSha256,
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
      hiddenWatermarkPayload: (() => {
        try {
          return JSON.parse(copy.hiddenWatermarkPayload);
        } catch {
          return copy.hiddenWatermarkPayload;
        }
      })(),
    };
  }
}
