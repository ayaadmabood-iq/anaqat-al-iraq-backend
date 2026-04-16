import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { OutfitRecommendation } from './outfit-recommendation.entity';
import { ClothingItem } from './clothing-item.entity';

@Entity('outfit_recommendation_items')
@Index(['recommendationId'])
@Index(['clothingItemId'])
export class OutfitRecommendationItem {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  recommendationId: string;

  @ManyToOne(
    () => OutfitRecommendation,
    (rec) => rec.items,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'recommendationId' })
  recommendation: OutfitRecommendation;

  @Column('uuid', { nullable: false })
  clothingItemId: string;

  @ManyToOne(() => ClothingItem, (item) => item.outfitRecommendations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clothingItemId' })
  clothingItem: ClothingItem;

  @Column('varchar', { length: 100, nullable: false })
  role: string;
}
