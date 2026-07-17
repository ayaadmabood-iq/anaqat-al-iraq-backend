import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { LocalizedText } from './book.entity';

export type ArticleStatus = 'draft' | 'published' | 'suspended';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  title: LocalizedText;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  excerpt: LocalizedText;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  body: LocalizedText;

  @Column({ type: 'varchar', length: 200, nullable: true })
  authorDisplay: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: ArticleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
