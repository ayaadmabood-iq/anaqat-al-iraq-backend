import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
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
import { MailService } from '@/modules/mail/mail.service';
import { sniffAndValidate } from '@/modules/common/file-validators';

function newOrderNumber(): string {
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
    private readonly mail: MailService,
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
      currentGenerationNumber: o.issuedCopy?.currentGenerationNumber ?? null,
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

    // Defence in depth — check the actual bytes on disk before accepting.
    const uploadedAbs = path.join(
      process.env.TRANSFERS_DIR ||
        path.join(process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage'), 'transfers'),
      file.filename,
    );
    await sniffAndValidate(uploadedAbs, file.mimetype);

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

  async reissueForCustomer(user: User, orderId: string, ip?: string) {
    // Serialise reissue per order with a pg advisory lock. Two concurrent
    // reissue requests execute strictly one after the other, so each gets a
    // unique generation number in strict sequence (no unique-key racing).
    return this.orders.manager.transaction(async (tx) => {
      // hashtext returns an int; wrap in a stable pair for pg_advisory_xact_lock.
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext('reissue:' || $1::text))`,
        [orderId],
      );
      const order = await tx.getRepository(Order).findOne({
        where: { id: orderId, userId: user.id },
        relations: ['book', 'user'],
      });
      if (!order) throw new NotFoundException();
      if (order.status !== 'fulfilled') {
        throw new BadRequestException(
          'إعادة إنشاء النسخة متاحة فقط بعد اعتماد الطلب',
        );
      }
      const { copy, generation } = await this.fingerprint.issueCopyForOrder(
        order,
        order.book,
        order.user,
        { reason: 'reissue', triggeredByUserId: user.id },
      );
      await this.audit.record({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'copy.reissued',
        entity: 'issued_copy',
        entityId: copy.id,
        metadata: {
          orderNumber: order.orderNumber,
          copyUuid: copy.copyUuid,
          generationId: generation.generationId,
          generationNumber: generation.generationNumber,
          sha256: generation.fileSha256,
        },
        ipAddress: ip,
      });
      return {
        ok: true,
        copyUuid: copy.copyUuid,
        generationId: generation.generationId,
        generationNumber: generation.generationNumber,
        sha256: generation.fileSha256,
      };
    });
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
    // Idempotent status transition. `UPDATE ... WHERE status='awaiting_review'
    // RETURNING *` is atomic at the row level: two concurrent approve calls
    // race for the row lock; the winner sees `affected=1`, the loser sees
    // `affected=0` and gets a 400 without side effects. This also protects
    // against a second click on the same "approve" button in the admin UI.
    const now = new Date();
    const updated = await this.orders
      .createQueryBuilder()
      .update()
      .set({
        status: 'approved',
        approvedAt: now,
        approvedByUserId: admin.id,
      })
      .where('id = :id AND status = :expected', {
        id: orderId,
        expected: 'awaiting_review',
      })
      .execute();
    if (updated.affected === 0) {
      // Distinguish 404 from race: check whether the order exists at all.
      const exists = await this.orders.count({ where: { id: orderId } });
      if (exists === 0) throw new NotFoundException();
      throw new BadRequestException(
        'لا يمكن اعتماد طلب لا يزال بانتظار الدفع أو تم اعتماده مسبقاً',
      );
    }
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['book', 'user'],
    });
    if (!order) throw new NotFoundException();

    // The unique constraint `uq_generation_per_copy (issuedCopyId,
    // generationNumber)` guarantees no duplicate generation is ever
    // committed even if this method is somehow re-entered mid-issue.
    const { copy, generation } = await this.fingerprint.issueCopyForOrder(
      order,
      order.book,
      order.user,
      { reason: 'initial', triggeredByUserId: admin.id },
    );

    order.status = 'fulfilled';
    order.fulfilledAt = new Date();
    await this.orders.save(order);

    await this.audit.record({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'order.approved',
      entity: 'order',
      entityId: order.id,
      metadata: {
        copyUuid: copy.copyUuid,
        generationId: generation.generationId,
        generationNumber: generation.generationNumber,
        sha256: generation.fileSha256,
      },
      ipAddress: ip,
    });

    // Best-effort — do not block the approval on a mail hiccup.
    this.mail
      .sendOrderApprovedEmail({
        to: order.user.email,
        fullName: order.user.fullName,
        orderNumber: order.orderNumber,
      })
      .catch(() => undefined);

    return {
      ok: true,
      orderStatus: order.status,
      copyUuid: copy.copyUuid,
      generationId: generation.generationId,
      generationNumber: generation.generationNumber,
    };
  }

  async adminReissue(admin: User, orderId: string, ip?: string) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['book', 'user'],
    });
    if (!order) throw new NotFoundException();
    if (order.status !== 'fulfilled') {
      throw new BadRequestException('لا يمكن إعادة إصدار طلب غير مُنفَّذ');
    }
    const { copy, generation } = await this.fingerprint.issueCopyForOrder(
      order,
      order.book,
      order.user,
      { reason: 'admin_reissue', triggeredByUserId: admin.id },
    );
    await this.audit.record({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'copy.admin_reissued',
      entity: 'issued_copy',
      entityId: copy.id,
      metadata: {
        orderNumber: order.orderNumber,
        copyUuid: copy.copyUuid,
        generationId: generation.generationId,
        generationNumber: generation.generationNumber,
      },
      ipAddress: ip,
    });
    return {
      ok: true,
      copyUuid: copy.copyUuid,
      generationId: generation.generationId,
      generationNumber: generation.generationNumber,
    };
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
      actorRole: admin.role,
      action: 'order.rejected',
      entity: 'order',
      entityId: order.id,
      metadata: { reason },
      ipAddress: ip,
    });
    return { ok: true, orderStatus: order.status };
  }
}
