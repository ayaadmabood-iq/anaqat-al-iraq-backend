import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'qasdiya_platform',
  entities: [path.join(__dirname, '..', 'database', 'entities', '*.entity{.ts,.js}')],
  // synchronize is OFF everywhere by default. Development schema changes must
  // go through a migration; the seed script runs migrations before seeding.
  // Set DB_SYNCHRONIZE=true only during local prototyping.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development',
  dropSchema: false,
});
