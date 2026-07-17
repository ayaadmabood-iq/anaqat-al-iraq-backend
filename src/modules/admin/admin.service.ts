import { Injectable, NotFoundException } from '@nestjs/common';
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
}
