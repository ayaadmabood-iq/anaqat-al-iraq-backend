import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Store } from './store.entity';

export enum JobType {
  CLASSIFICATION = 'CLASSIFICATION',
  COLOR_DETECTION = 'COLOR_DETECTION',
  VOICE_PARSE = 'VOICE_PARSE',
  RECOMMENDATION = 'RECOMMENDATION',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('ai_processing_jobs')
@Index(['storeId', 'status', 'createdAt'])
@Index(['status'])
export class AiProcessingJob {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.aiJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('enum', { enum: JobType, nullable: false })
  jobType: JobType;

  @Column('enum', { enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Column('jsonb', { nullable: false })
  inputData: Record<string, any>;

  @Column('jsonb', { nullable: true })
  outputData: Record<string, any>;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  completedAt: Date;
}
