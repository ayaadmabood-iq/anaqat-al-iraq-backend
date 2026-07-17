import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IssuedCopy } from './issued-copy.entity';

/**
 * Immutable audit trail of every PDF file produced for a personal copy.
 *
 * The parent {@link IssuedCopy} is the purchase identity (one row per order,
 * with the stable `copyUuid`). Every issue OR reissue appends a new row here
 * with its own `generationId`, an incrementing `generationNumber`, a fresh
 * SHA-256, and a fresh detached signature. Nothing here is ever mutated —
 * the previous generations stay around so we can trace which specific file
 * was leaked.
 */
@Entity('issued_copy_generations')
@Unique('uq_generation_per_copy', ['issuedCopyId', 'generationNumber'])
export class IssuedCopyGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  issuedCopyId: string;

  @ManyToOne(() => IssuedCopy, (c) => c.generations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issuedCopyId' })
  issuedCopy: IssuedCopy;

  /** UUID unique to this specific file, independent of `copyUuid`. */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  generationId: string;

  /** 1-based sequence for a given issuedCopy. First issue = 1, first reissue = 2. */
  @Column({ type: 'integer' })
  generationNumber: number;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 128 })
  fileSha256: string;

  /**
   * The exact payload that was signed. Kept next to the signature so
   * verification does not depend on reconstructing fields from other tables
   * (which would drift as columns change).
   */
  @Column({ type: 'jsonb' })
  signedPayload: {
    copyUuid: string;
    generationId: string;
    generationNumber: number;
    orderNumber: string;
    bookId: string;
    bookEdition: string;
    buyerUserId: string;
    fileSha256: string;
    issuedAt: string;
  };

  @Column({ type: 'jsonb' })
  signature: { algo: string; keyId: string; signedAt: string; value: string };

  @Column({ type: 'varchar', length: 32 })
  reason: string; // 'initial' | 'reissue' | 'admin_reissue'

  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
