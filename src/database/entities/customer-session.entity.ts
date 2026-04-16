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
import { OutfitRecommendation } from './outfit-recommendation.entity';

@Entity('customer_sessions')
@Index(['storeId', 'createdAt'])
@Index(['userId'])
export class CustomerSession {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.customerSessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('uuid', { nullable: false })
  userId: string;

  @ManyToOne(() => User, (user) => user.customerSessions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('varchar', { length: 500, nullable: true })
  customerImageUrl: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('varchar', { length: 10, nullable: true })
  customerGender: string | null;

  @Column('varchar', { length: 50, nullable: true })
  occasionContext: string | null;

  @Column('varchar', { length: 20, nullable: false, default: 'OPEN' })
  sessionStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => OutfitRecommendation, (rec) => rec.customerSession, {
    cascade: true,
  })
  recommendations: OutfitRecommendation[];
}
