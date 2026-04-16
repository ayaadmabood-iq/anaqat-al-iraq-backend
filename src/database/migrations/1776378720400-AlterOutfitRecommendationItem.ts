import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterOutfitRecommendationItem1776378720400 implements MigrationInterface {
  name = 'AlterOutfitRecommendationItem1776378720400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendation_items" ADD COLUMN IF NOT EXISTS "sizeSelected" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendation_items" ADD COLUMN IF NOT EXISTS "unitPriceIqd" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendation_items" DROP COLUMN IF EXISTS "unitPriceIqd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendation_items" DROP COLUMN IF EXISTS "sizeSelected"`,
    );
  }
}
