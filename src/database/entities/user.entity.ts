import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Store } from './store.entity';
import { Sale } from './sale.entity';
import { CustomerSession } from './customer-session.entity';
import { AuditLog } from './audit-log.entity';

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SALES_STAFF = 'SALES_STAFF',
  INVENTORY_STAFF = 'INVENTORY_STAFF',
}

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string = uuid();

  @Column('varchar', { length: 100, nullable: false })
  username: string;

  @Column('varchar', { length: 255, nullable: false })
  passwordHash: string;

  @Column('varchar', { length: 255, nullable: false })
  fullName: string;

  @Column('enum', { enum: UserRole, default: UserRole.SALES_STAFF })
  role: UserRole;

  @Column('uuid', { nullable: false })
  storeId: string;

  @ManyToOne(() => Store, (store) => store.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Sale, (sale) => sale.user)
  sales: Sale[];

  @OneToMany(() => CustomerSession, (session) => session.user)
  customerSessions: CustomerSession[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}
