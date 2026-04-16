import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Store } from './store.entity';
import { ClothingCategory } from './clothing-category.entity';
import { SizeStock } from './size-stock.entity';
import { SaleLine } from './sale-line.entity';
import { OutfitRecommendationItem } from './outfit-recommendation-item.entity';

export enum AudienceTag {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  UNISEX = 'UNISEX',
}

@Entity('clothing_items')
@Index(['storeId', 'isActive'])
@Index(['categoryId', 'isActive'])
export class ClothingItem {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.clothingItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('uuid', { nullable: false })
  categoryId: string;

  @ManyToOne(() => ClothingCategory, (category) => category.clothingItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: ClothingCategory;

  @Column('varchar', { length: 100, nullable: false })
  primaryColor: string;

  @Column('varchar', { length: 100, nullable: true })
  secondaryColor: string;

  @Column('varchar', { length: 100, nullable: true })
  colorFamily: string;

  @Column('varchar', { length: 100, nullable: true })
  styleTag: string;

  @Column('enum', { enum: AudienceTag, default: AudienceTag.UNISEX })
  audienceTag: AudienceTag;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('varchar', { length: 500, nullable: true })
  imageUrl: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => SizeStock, (stock) => stock.clothingItem, {
    cascade: true,
    eager: true,
  })
  sizes: SizeStock[];

  @OneToMany(() => SaleLine, (line) => line.clothingItem)
  saleLines: SaleLine[];

  @OneToMany(() => OutfitRecommendationItem, (item) => item.clothingItem)
  outfitRecommendations: OutfitRecommendationItem[];
}
