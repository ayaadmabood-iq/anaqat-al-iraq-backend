import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterCustomerSession1776378720200 implements MigrationInterface {
  name = 'AlterCustomerSession1776378720200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" ADD COLUMN IF NOT EXISTS "customerGender" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" ADD COLUMN IF NOT EXISTS "occasionContext" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" ADD COLUMN IF NOT EXISTS "sessionStatus" character varying(20) NOT NULL DEFAULT 'OPEN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" DROP COLUMN IF EXISTS "sessionStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" DROP COLUMN IF EXISTS "occasionContext"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_sessions" DROP COLUMN IF EXISTS "customerGender"`,
    );
  }
}
