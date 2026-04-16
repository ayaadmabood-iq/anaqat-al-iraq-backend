import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CustomerSession } from './customer-session.entity';
import { ClothingItem } from './clothing-item.entity';

@Entity('inventory_match_scores')
@Index(['sessionId'])
@Index(['clothingItemId'])
export class InventoryMatchScore {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  sessionId: string;

  @ManyToOne(() => CustomerSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: CustomerSession;

  @Column('uuid', { nullable: false })
  clothingItemId: string;

  @ManyToOne(() => ClothingItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clothingItemId' })
  clothingItem: ClothingItem;

  @Column('decimal', { precision: 5, scale: 4, nullable: false })
  score: number;

  @Column('jsonb', { nullable: false })
  scoreBreakdown: { color: number; category: number; recency: number };

  @Column('boolean', { nullable: false })
  inStock: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
