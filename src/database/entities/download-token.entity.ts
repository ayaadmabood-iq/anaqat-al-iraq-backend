import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Single-use signed download link registry. Enforced by a UNIQUE index on
 * `jti` — a token is spent atomically by INSERTing here. If the INSERT
 * fails (already spent), the download endpoint returns 410 Gone.
 *
 * Rows are kept for 30 days for forensic replay analysis and then can be
 * cleaned by a cron (documented in docs/OPERATIONS.md).
 */
@Entity('download_tokens')
export class DownloadToken {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  jti: string; // 16-byte nonce, hex

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'uuid' })
  generationId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz' })
  consumedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  consumedIp: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
