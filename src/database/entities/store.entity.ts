import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { User } from './user.entity';
import { ClothingItem } from './clothing-item.entity';
import { Sale } from './sale.entity';
import { CustomerSession } from './customer-session.entity';
import { AiProcessingJob } from './ai-processing-job.entity';
import { AuditLog } from './audit-log.entity';

@Entity('stores')
export class Store {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('varchar', { length: 255, nullable: false })
  name: string;

  @Column('varchar', { length: 500, nullable: true })
  address: string;

  @Column('varchar', { length: 20, nullable: true })
  phone: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => User, (user) => user.store)
  users: User[];

  @OneToMany(() => ClothingItem, (item) => item.store)
  clothingItems: ClothingItem[];

  @OneToMany(() => Sale, (sale) => sale.store)
  sales: Sale[];

  @OneToMany(() => CustomerSession, (session) => session.store)
  customerSessions: CustomerSession[];

  @OneToMany(() => AiProcessingJob, (job) => job.store)
  aiJobs: AiProcessingJob[];

  @OneToMany(() => AuditLog, (log) => log.store)
  auditLogs: AuditLog[];
}
