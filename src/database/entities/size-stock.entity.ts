import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ClothingItem } from './clothing-item.entity';

@Entity('size_stocks')
@Unique('UQ_clothing_item_size', ['clothingItemId', 'size'])
@Index(['clothingItemId'])
export class SizeStock {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  clothingItemId: string;

  @ManyToOne(() => ClothingItem, (item) => item.sizes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clothingItemId' })
  clothingItem: ClothingItem;

  @Column('varchar', { length: 50, nullable: false })
  size: string;

  @Column('integer', { default: 0 })
  quantity: number;
}
