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

  @CreateDateColumn({ type: 'timestamptz' })
  downloadedAt: Date;
}
