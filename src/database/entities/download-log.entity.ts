import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IssuedCopy } from './issued-copy.entity';

/**
 * Per-download log (IRPB file 4 §6): date, IP, browser, OS, UUID, order#.
 */
@Entity('download_logs')
export class DownloadLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  issuedCopyId: string;

  @ManyToOne(() => IssuedCopy, (c) => c.downloads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issuedCopyId' })
  issuedCopy: IssuedCopy;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  os: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  downloadedAt: Date;
}
