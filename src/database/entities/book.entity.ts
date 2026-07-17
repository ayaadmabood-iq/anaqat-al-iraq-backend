import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { BookCategory } from './book-category.entity';

export type BookStatus = 'draft' | 'published' | 'suspended';

/**
 * A localized string map keyed by ISO language code (ar, en, …).
 * JSONB lets us add new languages without touching the schema — item 5 in the
 * founding document ("قاعدة البيانات تدعم إضافة لغات جديدة مستقبلاً").
 */
export type LocalizedText = { [langCode: string]: string };

@Entity('books')
@Index('idx_books_status_featured', ['status', 'isFeatured'])
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

  /**
   * IRPB file 4 §3 — "إصدار الكتاب" is injected into the fingerprint. Bump
   * this string every time you re-upload masterPdfPath so old and new copies
   * can be told apart.
   */
  @Column({ type: 'varchar', length: 32, default: '1' })
  editionVersion: string;

  /**
   * Public sample PDF (§9 file 2, §6 file 5). Anyone can download it without
   * an account. Path is relative to STORAGE_ROOT/books.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  samplePdfPath: string | null;

  @Column({ type: 'integer', default: 0 })
  pageCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  priceUsd: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  priceIqd: string | null;

  /**
   * Free-form searchable keywords ("كلمات مفتاحية" — file 2 §8).
   */
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  keywords: string[];

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => BookCategory, (c) => c.books, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category: BookCategory | null;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

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
