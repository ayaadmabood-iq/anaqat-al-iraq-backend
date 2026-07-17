import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@/database';

export interface AuditContext {
  actorUserId?: string | null;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(ctx: AuditContext): Promise<void> {
    try {
      const row = this.repo.create({
        actorUserId: ctx.actorUserId ?? null,
        actorRole: ctx.actorRole ?? 'anonymous',
        action: ctx.action,
        entity: ctx.entity ?? null,
        entityId: ctx.entityId ?? null,
        metadata: ctx.metadata ?? null,
        ipAddress: ctx.ipAddress ?? null,
      });
      await this.repo.save(row);
    } catch (err) {
      // Audit failure must never break a business flow.
      this.logger.error(`Audit write failed for ${ctx.action}: ${(err as Error).message}`);
    }
  }
}
