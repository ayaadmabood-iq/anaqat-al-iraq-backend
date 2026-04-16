/**
 * Standalone DataSource used by the TypeORM CLI for migrations.
 *
 * Runs outside the Nest DI container (scripts like `migration:generate`
 * execute this file directly), so it must load its own env. Production
 * deploys call `npm run migration:run` against this data source BEFORE
 * starting the Nest app, which is why synchronize is hard-coded to false.
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as path from 'path';
import configuration from './config/configuration';
import {
  Store,
  User,
  ClothingCategory,
  ClothingItem,
  SizeStock,
  Sale,
  SaleLine,
  CustomerSession,
  OutfitRecommendation,
  OutfitRecommendationItem,
  AiProcessingJob,
  AuditLog,
} from './database';

const c = configuration();

export default new DataSource({
  type: 'postgres',
  host: c.database.host,
  port: c.database.port,
  username: c.database.username,
  password: c.database.password,
  database: c.database.name,
  ssl: c.database.ssl ? { rejectUnauthorized: c.database.sslRejectUnauthorized } : false,
  entities: [
    Store,
    User,
    ClothingCategory,
    ClothingItem,
    SizeStock,
    Sale,
    SaleLine,
    CustomerSession,
    OutfitRecommendation,
    OutfitRecommendationItem,
    AiProcessingJob,
    AuditLog,
  ],
  migrations: [path.join(__dirname, 'database', 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});
