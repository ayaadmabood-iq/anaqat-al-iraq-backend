import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryMatchScore1776378720600 implements MigrationInterface {
  name = 'CreateInventoryMatchScore1776378720600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory_match_scores" (
        "id" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "clothingItemId" uuid NOT NULL,
        "score" numeric(5,4) NOT NULL,
        "scoreBreakdown" jsonb NOT NULL,
        "inStock" boolean NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_match_scores" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_match_sessionId" ON "inventory_match_scores" ("sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_match_clothingItemId" ON "inventory_match_scores" ("clothingItemId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_match_scores" ADD CONSTRAINT "FK_match_session" FOREIGN KEY ("sessionId") REFERENCES "customer_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_match_scores" ADD CONSTRAINT "FK_match_clothing_item" FOREIGN KEY ("clothingItemId") REFERENCES "clothing_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_match_scores" DROP CONSTRAINT "FK_match_clothing_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_match_scores" DROP CONSTRAINT "FK_match_session"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_match_clothingItemId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_match_sessionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_match_scores"`);
  }
}
