import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Book } from './book.entity';
import type { LocalizedText } from './book.entity';

@Entity('book_categories')
export class BookCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  name: LocalizedText;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  description: LocalizedText;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Book, (b) => b.category)
  books: Book[];
}
