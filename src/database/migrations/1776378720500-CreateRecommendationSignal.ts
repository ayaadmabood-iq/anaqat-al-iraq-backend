import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecommendationSignal1776378720500 implements MigrationInterface {
  name = 'CreateRecommendationSignal1776378720500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "recommendation_signals" (
        "id" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "source" character varying(30) NOT NULL,
        "primaryColor" character varying(30),
        "primaryHex" character varying(7),
        "secondaryColor" character varying(30),
        "audienceTag" character varying(10),
        "categoryHints" jsonb,
        "rawLabels" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recommendation_signals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_signal_sessionId" ON "recommendation_signals" ("sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_signal_sessionId" ON "recommendation_signals" ("sessionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "recommendation_signals" ADD CONSTRAINT "FK_signal_session" FOREIGN KEY ("sessionId") REFERENCES "customer_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recommendation_signals" DROP CONSTRAINT "FK_signal_session"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_signal_sessionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_signal_sessionId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recommendation_signals"`);
  }
}
