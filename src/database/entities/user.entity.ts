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

/**
 * RBAC per IRPB file 3 §7. The MVP-critical roles are `super_admin` (owner)
 * and `customer` (default for signup); the other four are recognised in the
 * schema so the founder can create staff accounts without a redeploy.
 *
 * `admin` and `user` are kept as legacy aliases and behave as `super_admin`
 * and `customer` respectively.
 */
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'content_manager'
  | 'finance_manager'
  | 'support'
  | 'customer'
  | 'user';

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

  @Column({ type: 'varchar', length: 24, default: 'customer' })
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

  /**
   * Bumped whenever the credential material or role changes. JWTs embed the
   * value they were signed with; a mismatch → the token is rejected. Lets a
   * password reset invalidate every existing session without a token
   * blacklist.
   */
  @Column({ type: 'integer', default: 1 })
  tokenVersion: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Order, (o) => o.user)
  orders: Order[];

  @OneToMany(() => IssuedCopy, (c) => c.user)
  issuedCopies: IssuedCopy[];
}
