import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776378720123 implements MigrationInterface {
    name = 'InitialSchema1776378720123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "clothing_categories" ("id" uuid NOT NULL, "nameAr" character varying(255) NOT NULL, "nameEn" character varying(255) NOT NULL, "parentCategoryId" uuid, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_4e7720c21b30b7de1c6a4154b41" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "size_stocks" ("id" uuid NOT NULL, "clothingItemId" uuid NOT NULL, "size" character varying(50) NOT NULL, "quantity" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_clothing_item_size" UNIQUE ("clothingItemId", "size"), CONSTRAINT "PK_513f824bb0056140d77d7520dd9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9ef6407ce24b310d39ff55cd79" ON "size_stocks" ("clothingItemId") `);
        await queryRunner.query(`CREATE TABLE "customer_sessions" ("id" uuid NOT NULL, "storeId" uuid NOT NULL, "userId" uuid NOT NULL, "customerImageUrl" character varying(500), "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c684ecbaa67a634723776229c4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_964082235f1451578d18c02034" ON "customer_sessions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5581b630e8f70d5975696ec15" ON "customer_sessions" ("storeId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "outfit_recommendations" ("id" uuid NOT NULL, "customerSessionId" uuid NOT NULL, "rank" integer NOT NULL, "reasonAr" text NOT NULL, "reasonEn" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_77b0469fbe55e1f076ad140de74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a3638a9fde2e7a0d0a9fb2c5fd" ON "outfit_recommendations" ("customerSessionId") `);
        await queryRunner.query(`CREATE TABLE "outfit_recommendation_items" ("id" uuid NOT NULL, "recommendationId" uuid NOT NULL, "clothingItemId" uuid NOT NULL, "role" character varying(100) NOT NULL, CONSTRAINT "PK_0382cea5c5a8cbc447b2c392485" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c3de4098ef33ad85e2f2becaae" ON "outfit_recommendation_items" ("clothingItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_32f440f6f0a21a91e1bd6c5753" ON "outfit_recommendation_items" ("recommendationId") `);
        await queryRunner.query(`CREATE TYPE "public"."clothing_items_audiencetag_enum" AS ENUM('MEN', 'WOMEN', 'UNISEX')`);
        await queryRunner.query(`CREATE TABLE "clothing_items" ("id" uuid NOT NULL, "storeId" uuid NOT NULL, "categoryId" uuid NOT NULL, "primaryColor" character varying(100) NOT NULL, "secondaryColor" character varying(100), "colorFamily" character varying(100), "styleTag" character varying(100), "audienceTag" "public"."clothing_items_audiencetag_enum" NOT NULL DEFAULT 'UNISEX', "price" numeric(10,2), "notes" text, "imageUrl" character varying(500), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4b01465a35c16fb38e13aa9571f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4632c2088258edc76f068c1823" ON "clothing_items" ("categoryId", "isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3e1dd5449cab908e3fbbd2f53" ON "clothing_items" ("storeId", "isActive") `);
        await queryRunner.query(`CREATE TABLE "sale_lines" ("id" uuid NOT NULL, "saleId" uuid NOT NULL, "clothingItemId" uuid NOT NULL, "size" character varying(50) NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(10,2), CONSTRAINT "PK_d3e4396511029d8a97d9e946fb1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_99b573c8b296eab0beef02328f" ON "sale_lines" ("clothingItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b9839a37392398a402bc130e1a" ON "sale_lines" ("saleId") `);
        await queryRunner.query(`CREATE TABLE "sales" ("id" uuid NOT NULL, "storeId" uuid NOT NULL, "userId" uuid NOT NULL, "totalAmount" numeric(12,2), "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_52ff6cd9431cc7687c76f93593" ON "sales" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8aab484ac93b3d16d26db81c0a" ON "sales" ("storeId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL, "storeId" uuid NOT NULL, "userId" uuid, "action" character varying(255) NOT NULL, "entityType" character varying(100) NOT NULL, "entityId" character varying(255) NOT NULL, "details" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cfa83f61e4d27a87fcae1e025a" ON "audit_logs" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d1c094cc46ef44b3018389dd7" ON "audit_logs" ("storeId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('OWNER', 'MANAGER', 'SALES_STAFF', 'INVENTORY_STAFF')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL, "username" character varying(100) NOT NULL, "passwordHash" character varying(255) NOT NULL, "fullName" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'SALES_STAFF', "storeId" uuid NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ai_processing_jobs_jobtype_enum" AS ENUM('CLASSIFICATION', 'COLOR_DETECTION', 'VOICE_PARSE', 'RECOMMENDATION')`);
        await queryRunner.query(`CREATE TYPE "public"."ai_processing_jobs_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "ai_processing_jobs" ("id" uuid NOT NULL, "storeId" uuid NOT NULL, "jobType" "public"."ai_processing_jobs_jobtype_enum" NOT NULL, "status" "public"."ai_processing_jobs_status_enum" NOT NULL DEFAULT 'PENDING', "inputData" jsonb NOT NULL, "outputData" jsonb, "errorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, CONSTRAINT "PK_799448d7f1171ef123ea8b7f917" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1bbbdc0f3c723cd9f80c482a4a" ON "ai_processing_jobs" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_68327ab66848318d71fae05d29" ON "ai_processing_jobs" ("storeId", "status", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "stores" ("id" uuid NOT NULL, "name" character varying(255) NOT NULL, "address" character varying(500), "phone" character varying(20), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "clothing_categories" ADD CONSTRAINT "FK_40ced53f06429912779156e5b04" FOREIGN KEY ("parentCategoryId") REFERENCES "clothing_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "size_stocks" ADD CONSTRAINT "FK_9ef6407ce24b310d39ff55cd79e" FOREIGN KEY ("clothingItemId") REFERENCES "clothing_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer_sessions" ADD CONSTRAINT "FK_14d5afcdcf8ea0ad923506960e2" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer_sessions" ADD CONSTRAINT "FK_964082235f1451578d18c020342" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendations" ADD CONSTRAINT "FK_a3638a9fde2e7a0d0a9fb2c5fd6" FOREIGN KEY ("customerSessionId") REFERENCES "customer_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendation_items" ADD CONSTRAINT "FK_32f440f6f0a21a91e1bd6c57532" FOREIGN KEY ("recommendationId") REFERENCES "outfit_recommendations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendation_items" ADD CONSTRAINT "FK_c3de4098ef33ad85e2f2becaaed" FOREIGN KEY ("clothingItemId") REFERENCES "clothing_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clothing_items" ADD CONSTRAINT "FK_a39be9b1c6758f7543ed1e6c60f" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clothing_items" ADD CONSTRAINT "FK_4f338afac3891976b9986f52b6e" FOREIGN KEY ("categoryId") REFERENCES "clothing_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_lines" ADD CONSTRAINT "FK_b9839a37392398a402bc130e1a5" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sale_lines" ADD CONSTRAINT "FK_99b573c8b296eab0beef02328f1" FOREIGN KEY ("clothingItemId") REFERENCES "clothing_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_ef0e802924109a86947d4df5c9e" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales" ADD CONSTRAINT "FK_52ff6cd9431cc7687c76f935938" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_78391c7649b00dcd33f66dbc906" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_c82cd4fa8f0ac4a74328abe997a" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ai_processing_jobs" ADD CONSTRAINT "FK_3a7912e5aafc7cb8e8326100d21" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ai_processing_jobs" DROP CONSTRAINT "FK_3a7912e5aafc7cb8e8326100d21"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_c82cd4fa8f0ac4a74328abe997a"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_78391c7649b00dcd33f66dbc906"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_52ff6cd9431cc7687c76f935938"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_ef0e802924109a86947d4df5c9e"`);
        await queryRunner.query(`ALTER TABLE "sale_lines" DROP CONSTRAINT "FK_99b573c8b296eab0beef02328f1"`);
        await queryRunner.query(`ALTER TABLE "sale_lines" DROP CONSTRAINT "FK_b9839a37392398a402bc130e1a5"`);
        await queryRunner.query(`ALTER TABLE "clothing_items" DROP CONSTRAINT "FK_4f338afac3891976b9986f52b6e"`);
        await queryRunner.query(`ALTER TABLE "clothing_items" DROP CONSTRAINT "FK_a39be9b1c6758f7543ed1e6c60f"`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendation_items" DROP CONSTRAINT "FK_c3de4098ef33ad85e2f2becaaed"`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendation_items" DROP CONSTRAINT "FK_32f440f6f0a21a91e1bd6c57532"`);
        await queryRunner.query(`ALTER TABLE "outfit_recommendations" DROP CONSTRAINT "FK_a3638a9fde2e7a0d0a9fb2c5fd6"`);
        await queryRunner.query(`ALTER TABLE "customer_sessions" DROP CONSTRAINT "FK_964082235f1451578d18c020342"`);
        await queryRunner.query(`ALTER TABLE "customer_sessions" DROP CONSTRAINT "FK_14d5afcdcf8ea0ad923506960e2"`);
        await queryRunner.query(`ALTER TABLE "size_stocks" DROP CONSTRAINT "FK_9ef6407ce24b310d39ff55cd79e"`);
        await queryRunner.query(`ALTER TABLE "clothing_categories" DROP CONSTRAINT "FK_40ced53f06429912779156e5b04"`);
        await queryRunner.query(`DROP TABLE "stores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68327ab66848318d71fae05d29"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1bbbdc0f3c723cd9f80c482a4a"`);
        await queryRunner.query(`DROP TABLE "ai_processing_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."ai_processing_jobs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ai_processing_jobs_jobtype_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d1c094cc46ef44b3018389dd7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cfa83f61e4d27a87fcae1e025a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8aab484ac93b3d16d26db81c0a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52ff6cd9431cc7687c76f93593"`);
        await queryRunner.query(`DROP TABLE "sales"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b9839a37392398a402bc130e1a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99b573c8b296eab0beef02328f"`);
        await queryRunner.query(`DROP TABLE "sale_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3e1dd5449cab908e3fbbd2f53"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4632c2088258edc76f068c1823"`);
        await queryRunner.query(`DROP TABLE "clothing_items"`);
        await queryRunner.query(`DROP TYPE "public"."clothing_items_audiencetag_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32f440f6f0a21a91e1bd6c5753"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c3de4098ef33ad85e2f2becaae"`);
        await queryRunner.query(`DROP TABLE "outfit_recommendation_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3638a9fde2e7a0d0a9fb2c5fd"`);
        await queryRunner.query(`DROP TABLE "outfit_recommendations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5581b630e8f70d5975696ec15"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_964082235f1451578d18c02034"`);
        await queryRunner.query(`DROP TABLE "customer_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ef6407ce24b310d39ff55cd79"`);
        await queryRunner.query(`DROP TABLE "size_stocks"`);
        await queryRunner.query(`DROP TABLE "clothing_categories"`);
    }

}
