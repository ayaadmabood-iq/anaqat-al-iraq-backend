import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_transfer_proofs')
export class OrderTransferProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.transferProofs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 80 })
  transferReference: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  transferAmount: string;

  @Column({ type: 'varchar', length: 8 })
  transferCurrency: string;

  @Column({ type: 'date' })
  transferDate: string;

  @Column({ type: 'varchar', length: 500 })
  proofImagePath: string;

  @Column({ type: 'uuid', nullable: true })
  targetBankAccountId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
