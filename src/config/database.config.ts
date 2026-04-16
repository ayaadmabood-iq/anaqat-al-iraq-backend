import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import type { AppConfig } from './configuration';

/**
 * Async factory for TypeORM consumed by TypeOrmModule.forRootAsync.
 * Reads exclusively from validated ConfigService — never process.env.
 *
 * Production runs with synchronize:false and relies on migrations (see
 * src/data-source.ts + `npm run migration:run`).
 */
export const buildDatabaseConfig = (
  config: ConfigService,
  entities: TypeOrmModuleOptions['entities'],
): TypeOrmModuleOptions => {
  const db = config.get<AppConfig['database']>('database');
  if (!db) throw new Error('Database config missing from ConfigService');

  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.name,
    entities,
    migrations: [path.join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: db.synchronize,
    logging: db.logging,
    dropSchema: false,
    ssl: db.ssl ? { rejectUnauthorized: db.sslRejectUnauthorized } : false,
  };
};
