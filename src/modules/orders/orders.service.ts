import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  OrderTransferProof,
  User,
  IssuedCopy,
  BankAccount,
} from '@/database';
import { BooksService } from '@/modules/books/books.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UploadTransferDto } from './dto/upload-transfer.dto';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { AuditService } from '@/modules/audit/audit.service';

function newOrderNumber(): string {
  // QSD-YYYYMMDD-XXXXXX — reads as "قصدية" order and stays URL-safe.
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `QSD-${ymd}-${rand}`;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderTransferProof)
    private readonly proofs: Repository<OrderTransferProof>,
    @InjectRepository(BankAccount)
    private readonly banks: Repository<BankAccount>,
    @InjectRepository(IssuedCopy)
    private readonly copies: Repository<IssuedCopy>,
    private readonly books: BooksService,
    private readonly fingerprint: FingerprintService,
    private readonly audit: AuditService,
  ) {}

  async create(user: User, dto: CreateOrderDto, ip?: string): Promise<Order> {
    if (!user.emailVerified) {
      throw new ForbiddenException('يرجى تأكيد البريد الإلكتروني أولاً');
    }
    const book = await this.books.requirePublishedForPurchase(dto.bookId);
    const now = new Date();
    const order = this.orders.create({
      orderNumber: newOrderNumber(),
      userId: user.id,
      bookId: book.id,
      amount: book.priceUsd,
      currency: 'USD',
      status: 'pending_payment',
      agreementAccepted: true,
      agreementAcceptedAt: now,
    });
    const saved = await this.orders.save(order);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'order.created',
      entity: 'order',
      entityId: saved.id,
      metadata: { bookId: book.id, orderNumber: saved.orderNumber },
      ipAddress: ip,
    });

    return saved;
  }

  async listMine(user: User) {
    const rows = await this.orders.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      relations: ['book', 'issuedCopy'],
    });
    return rows.map((o) => this.summarizeForUser(o));
  }

  async getMine(user: User, orderId: string) {
    const o = await this.orders.findOne({
      where: { id: orderId, userId: user.id },
      relations: ['book', 'transferProofs', 'issuedCopy'],
    });
    if (!o) throw new NotFoundException();
    return this.summarizeForUser(o);
  }

  private summarizeForUser(o: Order) {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      amount: o.amount,
      currency: o.currency,
      book: o.book && {
        id: o.book.id,
        slug: o.book.slug,
        title: o.book.title,
      },
      rejectionReason: o.rejectionReason,
      createdAt: o.createdAt,
      approvedAt: o.approvedAt,
      fulfilledAt: o.fulfilledAt,
      canDownload: o.status === 'fulfilled' && !!o.issuedCopy,
    };
  }

  async attachTransferProof(
    user: User,
    orderId: string,
    dto: UploadTransferDto,
    file: Express.Multer.File | undefined,
    ip?: string,
  ) {
    if (!file) {
      throw new BadRequestException('صورة الحوالة مطلوبة');
    }
    const order = await this.orders.findOne({
      where: { id: orderId, userId: user.id },
    });
    if (!order) throw new NotFoundException();
    if (!['pending_payment', 'rejected'].includes(order.status)) {
      throw new BadRequestException(
        'لا يمكن رفع إشعار حوالة لطلب في هذه الحالة',
      );
    }
    if (dto.targetBankAccountId) {
      const bank = await this.banks.findOne({
        where: { id: dto.targetBankAccountId, isActive: true },
      });
      if (!bank) throw new BadRequestException('حساب مصرفي غير معروف');
    }

    const proof = this.proofs.create({
      orderId: order.id,
      transferReference: dto.transferReference,
      transferAmount: dto.transferAmount,
      transferCurrency: dto.transferCurrency ?? 'IQD',
      transferDate: dto.transferDate,
      proofImagePath: file.filename,
      targetBankAccountId: dto.targetBankAccountId ?? null,
      notes: dto.notes ?? null,
    });
    await this.proofs.save(proof);

    order.status = 'awaiting_review';
    order.rejectionReason = null;
    await this.orders.save(order);

    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'order.transfer_uploaded',
      entity: 'order',
      entityId: order.id,
      metadata: { proofId: proof.id },
      ipAddress: ip,
    });

    return { ok: true, orderStatus: order.status };
  }

  /**
   * IRPB file 4 §7 — customer reissue endpoint. Only fulfilled orders qualify;
   * the copy keeps the same UUID and fingerprint payload, only a new file and
   * hash are produced.
   */
  async reissueForCustomer(user: User, orderId: string, ip?: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, userId: user.id },
      relations: ['book', 'user'],
    });
    if (!order) throw new NotFoundException();
    if (order.status !== 'fulfilled') {
      throw new BadRequestException(
        'إعادة إنشاء النسخة متاحة فقط بعد اعتماد الطلب',
      );
    }
    const copy = await this.fingerprint.issueCopyForOrder(
      order,
      order.book,
      order.user,
      { reissue: true },
    );
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'copy.reissued',
      entity: 'issued_copy',
      entityId: copy.id,
      metadata: { orderNumber: order.orderNumber, copyUuid: copy.copyUuid },
      ipAddress: ip,
    });
    return { ok: true, copyUuid: copy.copyUuid, sha256: copy.fileSha256 };
  }

  /* ─── admin side ─── */

  async listForAdmin(status?: string, q?: string) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('o.book', 'b')
      .leftJoinAndSelect('o.transferProofs', 'p')
      .leftJoinAndSelect('o.issuedCopy', 'c')
      .orderBy('o.createdAt', 'DESC');
    if (status) qb.andWhere('o.status = :st', { st: status });
    if (q) {
      const term = `%${q.trim()}%`;
      qb.andWhere(
        `(o.orderNumber ILIKE :t OR u.email ILIKE :t OR u.fullName ILIKE :t)`,
        { t: term },
      );
    }
    return qb.getMany();
  }

  async getForAdmin(id: string) {
    const row = await this.orders.findOne({
      where: { id },
      relations: ['user', 'book', 'transferProofs', 'issuedCopy'],
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async approve(admin: User, orderId: string, ip?: string) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['book', 'user'],
    });
    if (!order) throw new NotFoundException();
    if (order.status !== 'awaiting_review') {
      throw new BadRequestException(
        'لا يمكن اعتماد طلب لا يزال بانتظار الدفع أو تم اعتماده مسبقاً',
      );
    }
    order.status = 'approved';
    order.approvedAt = new Date();
    order.approvedByUserId = admin.id;
    await this.orders.save(order);

    const copy = await this.fingerprint.issueCopyForOrder(
      order,
      order.book,
      order.user,
    );

    order.status = 'fulfilled';
    order.fulfilledAt = new Date();
    await this.orders.save(order);

    await this.audit.record({
      actorUserId: admin.id,
      actorRole: 'admin',
      action: 'order.approved',
      entity: 'order',
      entityId: order.id,
      metadata: { copyUuid: copy.copyUuid, hash: copy.fileSha256 },
      ipAddress: ip,
    });

    return { ok: true, orderStatus: order.status, copyUuid: copy.copyUuid };
  }

  async reject(admin: User, orderId: string, reason: string, ip?: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException();
    if (order.status !== 'awaiting_review') {
      throw new BadRequestException('لا يمكن رفض طلب في هذه الحالة');
    }
    order.status = 'rejected';
    order.rejectionReason = reason;
    await this.orders.save(order);

    await this.audit.record({
      actorUserId: admin.id,
      actorRole: 'admin',
      action: 'order.rejected',
      entity: 'order',
      entityId: order.id,
      metadata: { reason },
      ipAddress: ip,
    });
    return { ok: true, orderStatus: order.status };
  }
}
