import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DownloadLog, IssuedCopy, Order, User } from '@/database';
import { FingerprintService } from '@/modules/fingerprint/fingerprint.service';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class DownloadsService {
  constructor(
    @InjectRepository(IssuedCopy) private readonly copies: Repository<IssuedCopy>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(DownloadLog) private readonly logs: Repository<DownloadLog>,
    private readonly fingerprint: FingerprintService,
    private readonly audit: AuditService,
  ) {}

  async prepareDownload(user: User, orderId: string, ip: string | undefined) {
    const order = await this.orders.findOne({
      where: { id: orderId, userId: user.id },
    });
    if (!order) throw new NotFoundException('order not found');
    if (order.status !== 'fulfilled') {
      throw new ForbiddenException('لم يتم اعتماد هذا الطلب بعد');
    }
    const copy = await this.copies.findOne({
      where: { orderId: order.id },
      relations: ['book'],
    });
    if (!copy) throw new NotFoundException('نسخة غير مُنشأة');
    const absPath = this.fingerprint.absolutePathFor(copy);
    const downloadFileName = `${copy.book.slug}-${copy.copyUuid}.pdf`;

    await this.logs.save(
      this.logs.create({
        issuedCopyId: copy.id,
        userId: user.id,
        ipAddress: ip ?? null,
      }),
    );
    await this.audit.record({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'copy.downloaded',
      entity: 'issued_copy',
      entityId: copy.id,
      metadata: { orderNumber: order.orderNumber, copyUuid: copy.copyUuid },
      ipAddress: ip,
    });

    return { absPath, downloadFileName };
  }

  async logsForCopy(copyId: string) {
    return this.logs.find({
      where: { issuedCopyId: copyId },
      order: { downloadedAt: 'DESC' },
    });
  }

  async allLogs(limit = 200) {
    return this.logs.find({ order: { downloadedAt: 'DESC' }, take: limit });
  }
}
