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
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Book } from './book.entity';
import { OrderTransferProof } from './order-transfer-proof.entity';
import { IssuedCopy } from './issued-copy.entity';

/**
 * Order lifecycle (§8 of the founding document):
 *   pending_payment → awaiting_review → approved → fulfilled
 *   pending_payment → cancelled
 *   awaiting_review → rejected → pending_payment (buyer may re-upload proof)
 */
export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_review'
  | 'approved'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  orderNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, (b) => b.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  @Column({ type: 'varchar', length: 24, default: 'pending_payment' })
  status: OrderStatus;

  @Column({ type: 'boolean', default: false })
  agreementAccepted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  agreementAcceptedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fulfilledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrderTransferProof, (p) => p.order)
  transferProofs: OrderTransferProof[];

  @OneToOne(() => IssuedCopy, (c) => c.order)
  issuedCopy: IssuedCopy | null;
}
