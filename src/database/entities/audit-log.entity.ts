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
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['storeId', 'createdAt'])
@Index(['userId'])
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('uuid', { nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.auditLogs, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('varchar', { length: 255, nullable: false })
  action: string;

  @Column('varchar', { length: 100, nullable: false })
  entityType: string;

  @Column('varchar', { length: 255, nullable: false })
  entityId: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
