import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CustomerSession } from './customer-session.entity';

@Entity('recommendation_signals')
@Unique(['sessionId'])
@Index(['sessionId'])
export class RecommendationSignal {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  sessionId: string;

  @ManyToOne(() => CustomerSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: CustomerSession;

  @Column('varchar', { length: 30, nullable: false })
  source: string;

  @Column('varchar', { length: 30, nullable: true })
  primaryColor: string | null;

  @Column('varchar', { length: 7, nullable: true })
  primaryHex: string | null;

  @Column('varchar', { length: 30, nullable: true })
  secondaryColor: string | null;

  @Column('varchar', { length: 10, nullable: true })
  audienceTag: string | null;

  @Column('jsonb', { nullable: true })
  categoryHints: string[] | null;

  @Column('jsonb', { nullable: true })
  rawLabels: Record<string, any>[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
