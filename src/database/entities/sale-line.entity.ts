import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Sale } from './sale.entity';
import { ClothingItem } from './clothing-item.entity';

@Entity('sale_lines')
@Index(['saleId'])
@Index(['clothingItemId'])
export class SaleLine {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column('uuid', { nullable: false })
  clothingItemId: string;

  @ManyToOne(() => ClothingItem, (item) => item.saleLines, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clothingItemId' })
  clothingItem: ClothingItem;

  @Column('varchar', { length: 50, nullable: false })
  size: string;

  @Column('integer', { nullable: false })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitPrice: number;
}
