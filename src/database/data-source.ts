import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { ALL_ENTITIES } from './index';

dotenv.config();

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate/run/revert)
 * and by tests. Nest itself keeps using getDatabaseConfig(); the two are
 * intentionally identical.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'qasdiya_platform',
  entities: ALL_ENTITIES,
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsRun: false,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
