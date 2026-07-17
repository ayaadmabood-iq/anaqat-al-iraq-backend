import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The MVP does not ship separate CREATE TABLE statements per column — the
 * canonical shape lives in the TypeORM entities.
 *
 * When this migration runs it delegates to TypeORM's schema builder to bring
 * the schema up to the current entity metadata; on subsequent runs where
 * everything is already there, the schema builder is a no-op. Combined with
 * `synchronize: false` in production, only the migration runner can change
 * the schema.
 */
export class InitSchema1720000000000 implements MigrationInterface {
  name = 'InitSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // buildSchema respects entity metadata regardless of the datasource's
    // synchronize flag — this is the same code path that `ds.synchronize()`
    // executes.
    const schemaBuilder = queryRunner.connection.driver.createSchemaBuilder();
    await schemaBuilder.build();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropSchema('public', true, true);
    await queryRunner.createSchema('public');
  }
}
