import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

export type BookStatus = 'draft' | 'published' | 'suspended';

/**
 * A localized string map keyed by ISO language code (ar, en, …).
 * JSONB lets us add new languages without touching the schema — item 5 in the
 * founding document ("قاعدة البيانات تدعم إضافة لغات جديدة مستقبلاً").
 */
export type LocalizedText = { [langCode: string]: string };

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  title: LocalizedText;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  author: LocalizedText;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  description: LocalizedText;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImagePath: string | null;

  /**
   * Path (relative to STORAGE_ROOT/books) of the master PDF that will be
   * fingerprinted for each buyer. Kept out of the public API surface.
   */
  @Column({ type: 'varchar', length: 500 })
  masterPdfPath: string;

  @Column({ type: 'integer', default: 0 })
  pageCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  priceUsd: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  priceIqd: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: BookStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.book)
  orders: Order[];
}
