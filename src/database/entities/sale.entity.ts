import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Store } from './store.entity';
import { User } from './user.entity';
import { SaleLine } from './sale-line.entity';

@Entity('sales')
@Index(['storeId', 'createdAt'])
@Index(['userId'])
export class Sale {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('uuid', { nullable: false })
  userId: string;

  @ManyToOne(() => User, (user) => user.sales, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  totalAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => SaleLine, (line) => line.sale, { cascade: true, eager: true })
  lines: SaleLine[];
}
