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
import { CustomerSession } from './customer-session.entity';
import { OutfitRecommendationItem } from './outfit-recommendation-item.entity';

@Entity('outfit_recommendations')
@Index(['customerSessionId'])
export class OutfitRecommendation {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  customerSessionId: string;

  @ManyToOne(
    () => CustomerSession,
    (session) => session.recommendations,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'customerSessionId' })
  customerSession: CustomerSession;

  @Column('integer', { nullable: false })
  rank: number;

  @Column('text', { nullable: false })
  reasonAr: string;

  @Column('text', { nullable: true })
  reasonEn: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(
    () => OutfitRecommendationItem,
    (item) => item.recommendation,
    { cascade: true, eager: true },
  )
  items: OutfitRecommendationItem[];
}
