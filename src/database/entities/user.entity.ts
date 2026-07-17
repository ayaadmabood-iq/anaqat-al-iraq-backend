import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { IssuedCopy } from './issued-copy.entity';

export type UserRole = 'user' | 'admin';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 200 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 8, default: 'ar' })
  preferredLang: 'ar' | 'en';

  @Column({ type: 'varchar', length: 16, default: 'user' })
  role: UserRole;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  privacyAccepted: boolean;

  @Column({ type: 'boolean', default: false })
  termsAccepted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.user)
  orders: Order[];

  @OneToMany(() => IssuedCopy, (c) => c.user)
  issuedCopies: IssuedCopy[];
}
