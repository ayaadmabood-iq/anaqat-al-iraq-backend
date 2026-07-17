import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Free-form key/value settings (agreement text, contact info, hero content).
 * Kept out of hard-coded configuration so the owner can edit from the admin
 * panel without a redeploy.
 */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
