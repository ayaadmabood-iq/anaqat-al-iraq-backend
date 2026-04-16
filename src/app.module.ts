import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from '@/config/configuration';
import { validationSchema } from '@/config/validation.schema';
import { buildDatabaseConfig } from '@/config/database.config';
import type { AppConfig } from '@/config/configuration';
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
  RecommendationSignal,
  InventoryMatchScore,
} from '@/database';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { StoreModule } from '@/modules/store/store.module';
import { InventoryModule } from '@/modules/inventory/inventory.module';
import { SalesModule } from '@/modules/sales/sales.module';
import { HealthModule } from '@/modules/health/health.module';
import { ObservabilityModule } from '@/modules/observability/observability.module';

const entities = [
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
  RecommendationSignal,
  InventoryMatchScore,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
      envFilePath: ['.env'],
    }),
    // Logger comes first so downstream modules can inject PinoLogger.
    ObservabilityModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDatabaseConfig(config, entities),
    }),
    TypeOrmModule.forFeature(entities),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.get<AppConfig['throttle']>('throttle');
        return [{ ttl: (t?.ttlSeconds ?? 60) * 1000, limit: t?.limit ?? 120 }];
      },
    }),
    AuthModule,
    UsersModule,
    StoreModule,
    InventoryModule,
    SalesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
