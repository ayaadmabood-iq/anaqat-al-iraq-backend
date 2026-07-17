import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Book } from './book.entity';
import { Order } from './order.entity';
import { DownloadLog } from './download-log.entity';

/**
 * Fingerprint registry (§9 of the founding document). One row per personalized
 * PDF delivered to a buyer. The generated file is regenerated on demand from
 * these fields — nothing pre-baked is stored per user.
 */
@Entity('issued_copies')
export class IssuedCopy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  copyUuid: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @OneToOne(() => Order, (o) => o.issuedCopy, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.issuedCopies, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  /* Buyer fingerprint snapshot — kept even if the user later edits profile. */
  @Column({ type: 'varchar', length: 200 })
  buyerFullName: string;

  @Column({ type: 'varchar', length: 200 })
  buyerEmail: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  buyerPhone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  buyerCountry: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  buyerCity: string | null;

  @Column({ type: 'varchar', length: 500 })
  generatedFilePath: string;

  @Column({ type: 'varchar', length: 128 })
  fileSha256: string;

  @Column({ type: 'varchar', length: 500 })
  visibleWatermark: string;

  @Column({ type: 'text' })
  hiddenWatermarkPayload: string;

  @CreateDateColumn({ type: 'timestamptz' })
  issuedAt: Date;

  @OneToMany(() => DownloadLog, (d) => d.issuedCopy)
  downloads: DownloadLog[];
}
