import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '@/database';
import * as path from 'path';

/**
 * Boots a fresh schema on the test database (using migrations, not
 * synchronize) and returns a DataSource. Each caller owns its own DataSource
 * so tests can run in parallel by picking distinct schemas.
 */
export async function bootTestDataSource() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: ALL_ENTITIES,
    migrations: [
      path.join(__dirname, '..', '..', 'src', 'database', 'migrations', '*.ts'),
    ],
    synchronize: false,
    logging: false,
    dropSchema: false,
  });
  await ds.initialize();
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations();
  return ds;
}

export async function shutdownDataSource(ds: DataSource | null | undefined) {
  if (ds && ds.isInitialized) await ds.destroy();
}
