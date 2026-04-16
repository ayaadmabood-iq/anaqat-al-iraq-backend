import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { AppConfig } from './configuration';

/**
 * Async factory for TypeORM consumed by TypeOrmModule.forRootAsync.
 * Reads exclusively from validated ConfigService — never process.env.
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
    synchronize: db.synchronize,
    logging: db.logging,
    dropSchema: false,
  };
};
