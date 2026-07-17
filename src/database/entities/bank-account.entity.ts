import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Bank accounts shown to buyers at checkout (Rafidain + TBI in the launch spec,
 * item 8/4). Managed from the admin panel; only active rows are exposed to
 * users.
 */
@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  bankName: string;

  @Column({ type: 'varchar', length: 120 })
  accountHolder: string;

  @Column({ type: 'varchar', length: 80 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  iban: string | null;

  @Column({ type: 'varchar', length: 8, default: 'IQD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
