import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ClothingItem } from './clothing-item.entity';

@Entity('clothing_categories')
export class ClothingCategory {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('varchar', { length: 255, nullable: false })
  nameAr: string;

  @Column('varchar', { length: 255, nullable: false })
  nameEn: string;

  @Column('uuid', { nullable: true })
  parentCategoryId: string;

  @ManyToOne(() => ClothingCategory, (category) => category.subcategories, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentCategoryId' })
  parentCategory: ClothingCategory;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relations
  @OneToMany(() => ClothingCategory, (category) => category.parentCategory)
  subcategories: ClothingCategory[];

  @OneToMany(() => ClothingItem, (item) => item.category)
  clothingItems: ClothingItem[];
}
