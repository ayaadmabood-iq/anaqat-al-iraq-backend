import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterOutfitRecommendation1776378720300 implements MigrationInterface {
  name = 'AlterOutfitRecommendation1776378720300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD COLUMN IF NOT EXISTS "outfitLabel" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD COLUMN IF NOT EXISTS "totalPriceIqd" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD COLUMN IF NOT EXISTS "wasPresented" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD COLUMN IF NOT EXISTS "convertedSaleId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" ADD CONSTRAINT "FK_outfit_recommendation_sale" FOREIGN KEY ("convertedSaleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP CONSTRAINT IF EXISTS "FK_outfit_recommendation_sale"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP COLUMN IF EXISTS "convertedSaleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP COLUMN IF EXISTS "convertedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP COLUMN IF EXISTS "wasPresented"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP COLUMN IF EXISTS "totalPriceIqd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outfit_recommendations" DROP COLUMN IF EXISTS "outfitLabel"`,
    );
  }
}
