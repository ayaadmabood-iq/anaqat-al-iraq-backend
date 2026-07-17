import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Stores only the SHA-256 of the reset token — the plaintext is emailed
 * once and never stored. Combined with {@link consumedAt} and
 * {@link expiresAt} this enforces single-use, time-limited resets even if
 * the DB is later exfiltrated.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  /** Hex-encoded SHA-256 of the plaintext token issued to the user. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestIp: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
