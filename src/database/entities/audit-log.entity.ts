import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Audit trail (§11 of the founding document). Records the actor, the action,
 * and enough context to reconstruct sensitive events during forensic review.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 32 })
  actorRole: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entity: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
