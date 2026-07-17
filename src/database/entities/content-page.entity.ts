import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentPageVersion } from './content-page-version.entity';

/**
 * A CMS page — one row per key, with a draft and a published copy plus a
 * separate immutable version history in {@link ContentPageVersion}. Public
 * reads always return `publishedValue`; the admin panel edits `draftValue`
 * and calls `publish` to promote it and snapshot a new version.
 */
@Entity('content_pages')
export class ContentPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'jsonb' })
  draftValue: unknown;

  @Column({ type: 'jsonb', nullable: true })
  publishedValue: unknown | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ContentPageVersion, (v) => v.page)
  versions: ContentPageVersion[];
}
