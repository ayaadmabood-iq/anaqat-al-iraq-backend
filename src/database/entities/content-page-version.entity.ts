import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ContentPage } from './content-page.entity';

@Entity('content_page_versions')
@Unique('uq_page_version', ['pageId', 'version'])
export class ContentPageVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  pageId: string;

  @ManyToOne(() => ContentPage, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: ContentPage;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'varchar', length: 24 })
  action: 'draft_saved' | 'published';

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
